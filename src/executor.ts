/**
 * Executor - запуск pre-commit и ansible-lint
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LintResult } from './models/lintError';

export class Executor {

    /**
     * Проверить наличие конфигурационного файла в workspace
     */
    private static hasConfig(workspaceRoot: string, configName: string): boolean {
        const possibleNames = [configName, `.${configName}`, `${configName}.yaml`, `${configName}.yml`];
        for (const name of possibleNames) {
            const configPath = path.join(workspaceRoot, name);
            if (fs.existsSync(configPath)) {
                console.log(`[Executor] Found config: ${configPath}`);
                return true;
            }
        }
        return false;
    }

    /**
     * Получить путь к дефолтному конфигу из расширения
     */
    private static getDefaultConfigPath(configName: string): string | null {
        const extensionPath = vscode.extensions.getExtension('elementary1997.ansible-lint-helper')?.extensionPath;
        if (!extensionPath) {
            console.warn('[Executor] Extension path not found');
            return null;
        }
        const defaultConfigPath = path.join(extensionPath, 'defaults', configName);
        if (fs.existsSync(defaultConfigPath)) {
            console.log(`[Executor] Using default config: ${defaultConfigPath}`);
            return defaultConfigPath;
        }
        console.warn(`[Executor] Default config not found: ${defaultConfigPath}`);
        return null;
    }

    /**
     * Обеспечить наличие конфига (использовать из workspace или дефолтный)
     * Для yamllint возвращает путь к конфигу (можно передать через -c)
     * Для ansible-lint и pre-commit копирует дефолтный конфиг в workspace если нужно
     */
    private static ensureConfig(workspaceRoot: string, configName: string): string | null {
        // 1. Проверяем наличие конфига в workspace
        if (this.hasConfig(workspaceRoot, configName)) {
            console.log(`[Executor] Using workspace config: ${configName}`);
            return null; // Линтер сам найдет конфиг в workspace
        }

        // 2. Используем дефолтный конфиг
        const defaultPath = this.getDefaultConfigPath(configName);
        if (defaultPath) {
            console.log(`[Executor] No workspace config found, using default: ${configName}`);
            return defaultPath;
        }

        console.warn(`[Executor] No config found for ${configName}, using tool defaults`);
        return null;
    }

    /**
     * Копировать дефолтный конфиг в workspace если его нет
     */
    private static async copyDefaultConfigIfNeeded(workspaceRoot: string, configName: string): Promise<void> {
        // Проверяем наличие конфига в workspace
        if (this.hasConfig(workspaceRoot, configName)) {
            console.log(`[Executor] Config ${configName} already exists in workspace`);
            return;
        }

        // Получаем путь к дефолтному конфигу
        const defaultPath = this.getDefaultConfigPath(configName);
        if (!defaultPath) {
            console.warn(`[Executor] No default config found for ${configName}`);
            return;
        }

        // Копируем дефолтный конфиг в workspace
        const targetPath = path.join(workspaceRoot, configName.startsWith('.') ? configName : `.${configName}`);
        try {
            fs.copyFileSync(defaultPath, targetPath);
            console.log(`[Executor] Copied default config to ${targetPath}`);
            vscode.window.showInformationMessage(
                `📋 Created default ${configName} config in workspace. You can customize it if needed.`
            );
        } catch (error: any) {
            console.error(`[Executor] Failed to copy default config: ${error.message}`);
        }
    }

    /**
     * Поиск исполняемого файла в стандартных локациях
     */
    private static findExecutable(commandName: string, workspaceRoot?: string): string {
        const isWindows = process.platform === 'win32';
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';

        const searchPaths: string[] = [];

        // 1. venv в workspace
        if (workspaceRoot) {
            if (isWindows) {
                searchPaths.push(path.join(workspaceRoot, 'venv', 'Scripts', `${commandName}.exe`));
                searchPaths.push(path.join(workspaceRoot, '.venv', 'Scripts', `${commandName}.exe`));
            } else {
                searchPaths.push(path.join(workspaceRoot, 'venv', 'bin', commandName));
                searchPaths.push(path.join(workspaceRoot, '..', 'venv', 'bin', commandName));
                searchPaths.push(path.join(workspaceRoot, '.venv', 'bin', commandName));
            }
        }

        // 2. ~/.local/bin (pip install --user)
        if (homeDir && !isWindows) {
            searchPaths.push(path.join(homeDir, '.local', 'bin', commandName));
        }

        // 3. Стандартные системные пути
        if (!isWindows) {
            searchPaths.push(`/usr/local/bin/${commandName}`);
            searchPaths.push(`/usr/bin/${commandName}`);
            searchPaths.push(`/bin/${commandName}`);
        }

        // 4. pipx
        if (homeDir && !isWindows) {
            searchPaths.push(path.join(homeDir, '.local', 'pipx', 'venvs', commandName, 'bin', commandName));
        }

        // Ищем первый существующий файл
        for (const fullPath of searchPaths) {
            if (fs.existsSync(fullPath)) {
                try {
                    fs.accessSync(fullPath, fs.constants.X_OK);
                    console.log(`[Executor] Found ${commandName} at: ${fullPath}`);
                    return fullPath;
                } catch (e) {
                    // Не исполняемый файл, продолжаем поиск
                }
            }
        }

        // Fallback: возвращаем имя команды (может быть в PATH)
        console.log(`[Executor] ${commandName} not found in standard locations, using command name`);
        return commandName;
    }

    /**
     * Получить путь к ansible-lint из конфигурации или автоопределение
     */
    public static getAnsibleLintPath(workspaceRoot?: string): string {
        const config = vscode.workspace.getConfiguration('ansible-lint');
        const customPath = config.get<string>('executablePath');

        if (customPath && customPath.trim() !== '') {
            return customPath;
        }

        return this.findExecutable('ansible-lint', workspaceRoot);
    }

    /**
     * Получить путь к pre-commit из конфигурации или автоопределение
     */
    public static getPreCommitPath(workspaceRoot?: string): string {
        const config = vscode.workspace.getConfiguration('ansible-lint');
        const customPath = config.get<string>('preCommitPath');

        if (customPath && customPath.trim() !== '') {
            return customPath;
        }

        return this.findExecutable('pre-commit', workspaceRoot);
    }

    /**
     * Получить путь к yamllint из конфигурации или автоопределение
     */
    public static getYamllintPath(workspaceRoot?: string): string {
        const config = vscode.workspace.getConfiguration('ansible-lint');
        const customPath = config.get<string>('yamllintPath');

        if (customPath && customPath.trim() !== '') {
            return customPath;
        }

        return this.findExecutable('yamllint', workspaceRoot);
    }

    /**
     * Запуск команды через child_process
     */
    private static async runCommand(
        command: string,
        cwd: string,
        timeout: number = 30000
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            const extraPaths = [
                `${process.env.HOME || process.env.USERPROFILE}/.local/bin`,
                `${cwd}/venv/bin`,
                `${cwd}/../venv/bin`,
                '/usr/local/bin',
                '/usr/bin'
            ].filter(p => p);

            const pathSeparator = isWindows ? ';' : ':';
            const env = {
                ...process.env,
                PATH: `${extraPaths.join(pathSeparator)}${pathSeparator}${process.env.PATH}`,
                NO_COLOR: '1',  // Отключаем цвета для всех команд
                TERM: 'dumb'    // Отключаем ANSI escape коды
            };

            const startTime = Date.now();

            cp.exec(command, { cwd, timeout, env }, (error, stdout, stderr) => {
                const exitCode = error?.code || 0;
                const executionTime = Date.now() - startTime;

                console.log(`[Executor] Command: ${command}`);
                console.log(`[Executor] Exit code: ${exitCode}`);
                console.log(`[Executor] Execution time: ${executionTime}ms`);

                // Exit codes 0, 1, 2 для линтеров - это нормально
                // 0 - нет ошибок
                // 1, 2 - найдены ошибки (это то, что нам нужно)
                if (exitCode === 0 || exitCode === 1 || exitCode === 2) {
                    resolve({ stdout, stderr, exitCode });
                } else {
                    reject(new Error(`Command failed with code ${exitCode}: ${stderr || stdout || error?.message}`));
                }
            });
        });
    }

    /**
     * Запуск ansible-lint на файле
     */
    public static async runAnsibleLint(
        filePath: string,
        workspaceRoot: string,
        format: 'json' | 'pep8' | 'codeclimate' = 'pep8'
    ): Promise<LintResult> {
        const startTime = Date.now();

        // Обеспечить наличие .ansible-lint конфига
        await this.copyDefaultConfigIfNeeded(workspaceRoot, '.ansible-lint');

        const ansibleLintPath = this.getAnsibleLintPath(workspaceRoot);
        const relativePath = path.relative(workspaceRoot, filePath);
        const command = `"${ansibleLintPath}" --nocolor -f ${format} "${relativePath}"`;

        try {
            const result = await this.runCommand(command, workspaceRoot);
            return {
                errors: [], // Будет заполнено парсером
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            throw new Error(`ansible-lint failed: ${error.message}`);
        }
    }

    /**
     * Запуск ansible-lint на всех файлах проекта
     */
    public static async runAnsibleLintAll(
        workspaceRoot: string,
        format: 'json' | 'pep8' | 'codeclimate' = 'pep8'
    ): Promise<LintResult> {
        const startTime = Date.now();
        const ansibleLintPath = this.getAnsibleLintPath(workspaceRoot);
        const command = `"${ansibleLintPath}" --nocolor -f ${format}`;

        try {
            const result = await this.runCommand(command, workspaceRoot);
            return {
                errors: [], // Будет заполнено парсером
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            throw new Error(`ansible-lint failed: ${error.message}`);
        }
    }

    /**
     * Запуск pre-commit на файле
     */
    public static async runPreCommit(
        filePath: string,
        workspaceRoot: string
    ): Promise<LintResult> {
        const startTime = Date.now();

        // Обеспечить наличие .pre-commit-config.yaml
        await this.copyDefaultConfigIfNeeded(workspaceRoot, '.pre-commit-config.yaml');

        const preCommitPath = this.getPreCommitPath(workspaceRoot);
        const relativePath = path.relative(workspaceRoot, filePath);
        const command = `"${preCommitPath}" run --files "${relativePath}"`;

        try {
            const result = await this.runCommand(command, workspaceRoot);
            return {
                errors: [], // Будет заполнено парсером
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            throw new Error(`pre-commit failed: ${error.message}`);
        }
    }

    /**
     * Запуск pre-commit на всех файлах
     */
    public static async runPreCommitAll(
        workspaceRoot: string
    ): Promise<LintResult> {
        const startTime = Date.now();
        const preCommitPath = this.getPreCommitPath(workspaceRoot);
        const command = `"${preCommitPath}" run --all-files`;

        try {
            const result = await this.runCommand(command, workspaceRoot);
            return {
                errors: [], // Будет заполнено парсером
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            throw new Error(`pre-commit failed: ${error.message}`);
        }
    }

    /**
     * Запуск yamllint на файле
     */
    public static async runYamllint(
        filePath: string,
        workspaceRoot: string
    ): Promise<LintResult> {
        const startTime = Date.now();
        const yamllintPath = this.getYamllintPath(workspaceRoot);
        const relativePath = path.relative(workspaceRoot, filePath);

        // Проверяем наличие конфига yamllint
        const defaultConfigPath = this.ensureConfig(workspaceRoot, 'yamllint');
        const configArg = defaultConfigPath ? `-c "${defaultConfigPath}"` : '';

        const command = `"${yamllintPath}" ${configArg} -f parsable "${relativePath}"`;

        try {
            const result = await this.runCommand(command, workspaceRoot);
            return {
                errors: [], // Будет заполнено парсером
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            throw new Error(`yamllint failed: ${error.message}`);
        }
    }

    /**
     * Запуск yamllint на всех yaml файлах
     */
    public static async runYamllintAll(
        workspaceRoot: string
    ): Promise<LintResult> {
        const startTime = Date.now();
        const yamllintPath = this.getYamllintPath(workspaceRoot);

        // Проверяем наличие конфига yamllint
        const defaultConfigPath = this.ensureConfig(workspaceRoot, 'yamllint');
        const configArg = defaultConfigPath ? `-c "${defaultConfigPath}"` : '';

        const command = `"${yamllintPath}" ${configArg} -f parsable .`;

        try {
            const result = await this.runCommand(command, workspaceRoot);
            return {
                errors: [], // Будет заполнено парсером
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            throw new Error(`yamllint failed: ${error.message}`);
        }
    }

    /**
     * Запуск ansible-lint --fix на файле
     */
    public static async runAnsibleLintFix(
        filePath: string,
        workspaceRoot: string
    ): Promise<void> {
        const ansibleLintPath = this.getAnsibleLintPath(workspaceRoot);
        const relativePath = path.relative(workspaceRoot, filePath);
        const command = `"${ansibleLintPath}" --nocolor --fix "${relativePath}"`;

        try {
            await this.runCommand(command, workspaceRoot);
            console.log(`[Executor] ansible-lint --fix completed for ${relativePath}`);
        } catch (error: any) {
            // ansible-lint --fix может вернуть код 2, если остались неисправимые ошибки
            // Это нормально - файл все равно был исправлен частично
            if (!error.message.includes('code 2')) {
                throw error;
            }
        }
    }

    /**
     * Запуск ansible-lint --fix на всех файлах workspace
     */
    public static async runAnsibleLintFixAll(
        workspaceRoot: string
    ): Promise<void> {
        const ansibleLintPath = this.getAnsibleLintPath(workspaceRoot);
        const command = `"${ansibleLintPath}" --nocolor --fix`;

        try {
            await this.runCommand(command, workspaceRoot);
            console.log(`[Executor] ansible-lint --fix completed for all files`);
        } catch (error: any) {
            // ansible-lint --fix может вернуть код 2, если остались неисправимые ошибки
            // Это нормально - файлы все равно были исправлены частично
            if (!error.message.includes('code 2')) {
                throw error;
            }
        }
    }
}
