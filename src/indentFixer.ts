import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class IndentFixer {

    private static _lastPreCommitOutput: {code: number, stdout: string, stderr: string} | null = null;
    
    /**
     * Получить последний вывод pre-commit
     */
    public static getLastPreCommitOutput(): {code: number, stdout: string, stderr: string} | null {
        return this._lastPreCommitOutput;
    }

    /**
     * Ищет исполняемый файл в стандартных локациях
     * Возвращает полный путь или имя команды если найдена в PATH
     */
    private static findExecutable(commandName: string, workspaceRoot?: string): string {
        const isWindows = process.platform === 'win32';
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        
        // Список мест где искать (в порядке приоритета)
        const searchPaths: string[] = [];
        
        // 1. venv в workspace
        if (workspaceRoot) {
            searchPaths.push(path.join(workspaceRoot, 'venv', 'bin', commandName));
            searchPaths.push(path.join(workspaceRoot, '..', 'venv', 'bin', commandName));
            searchPaths.push(path.join(workspaceRoot, '.venv', 'bin', commandName));
        }
        
        // 2. ~/.local/bin (pip install --user)
        if (homeDir) {
            searchPaths.push(path.join(homeDir, '.local', 'bin', commandName));
        }
        
        // 3. Стандартные системные пути
        if (!isWindows) {
            searchPaths.push(`/usr/local/bin/${commandName}`);
            searchPaths.push(`/usr/bin/${commandName}`);
            searchPaths.push(`/bin/${commandName}`);
        }
        
        // 4. pipx
        if (homeDir) {
            searchPaths.push(path.join(homeDir, '.local', 'pipx', 'venvs', commandName, 'bin', commandName));
        }
        
        // Ищем первый существующий файл
        for (const fullPath of searchPaths) {
            if (fs.existsSync(fullPath)) {
                try {
                    fs.accessSync(fullPath, fs.constants.X_OK);
                    console.log(`[IndentFixer] Found ${commandName} at: ${fullPath}`);
                    return fullPath;
                } catch (e) {
                    // Не исполняемый файл, продолжаем поиск
                }
            }
        }
        
        // Fallback: возвращаем имя команды (может быть в PATH)
        console.log(`[IndentFixer] ${commandName} not found in standard locations, using command name`);
        return commandName;
    }

    /**
     * Run linters on fixed text and return diagnostics
     */
    public static async runLintersOnText(text: string, fileName: string, workspaceRoot: string): Promise<string[]> {
        const diagnostics: string[] = [];
        const tempFileName = `.temp_check_${Date.now()}${path.extname(fileName)}`;
        const tempFilePath = path.join(workspaceRoot, tempFileName);

        fs.writeFileSync(tempFilePath, text);

        try {
            // Check yamllint
            try {
                const yamllintCmd = this.findExecutable('yamllint', workspaceRoot);
                const yamllintOutput = await this.runCommand(`"${yamllintCmd}" -f parsable "${tempFileName}"`, workspaceRoot);
                if (yamllintOutput && yamllintOutput.length > 0) {
                    const formattedOutput = this.formatYamllintOutput(yamllintOutput, tempFileName);
                    diagnostics.push(`📋 yamllint:\n${formattedOutput}`);
                } else {
                    diagnostics.push('✅ yamllint: Ошибок не найдено');
                }
            } catch (err: any) {
                if (!err.message.includes('not found') && !err.message.includes('не является')) {
                    diagnostics.push(`⚠️ yamllint: ${err.message}`);
                }
            }

            // Check ansible-lint
            try {
                const ansibleLintCmd = this.findExecutable('ansible-lint', workspaceRoot);
                const ansibleLintOutput = await this.runCommand(`"${ansibleLintCmd}" -f pep8 "${tempFileName}"`, workspaceRoot);
                if (ansibleLintOutput && ansibleLintOutput.length > 0) {
                    const formattedOutput = this.formatAnsibleLintOutput(ansibleLintOutput, tempFileName);
                    diagnostics.push(`🔍 ansible-lint:\n${formattedOutput}`);
                } else {
                    diagnostics.push('✅ ansible-lint: Ошибок не найдено');
                }
            } catch (err: any) {
                if (!err.message.includes('not found') && !err.message.includes('не является')) {
                    diagnostics.push(`⚠️ ansible-lint: ${err.message}`);
                }
            }
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

        return diagnostics;
    }

    /**
     * Run linters and return diagnostics
     */
    public static async runLinters(activeEditor: vscode.TextEditor): Promise<string[]> {
        const document = activeEditor.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const diagnostics: string[] = [];

        if (!workspaceFolder) {
            return diagnostics;
        }

        const rootPath = workspaceFolder.uri.fsPath;
        const tempFileName = `.temp_lint_${Date.now()}${path.extname(document.fileName)}`;
        const tempFilePath = path.join(rootPath, tempFileName);

        // Write current document to temp file
        fs.writeFileSync(tempFilePath, document.getText());

        try {
            // Check for yamllint
            const hasYamllintConfig = fs.existsSync(path.join(rootPath, '.yamllint.yml')) || 
                                     fs.existsSync(path.join(rootPath, '.yamllint'));
            
            console.log(`[IndentFixer] yamllint config found: ${hasYamllintConfig}`);
            
            // Always try yamllint if config exists OR just try it
            try {
                const yamllintCmd = this.findExecutable('yamllint', rootPath);
                const yamllintOutput = await this.runCommand(`"${yamllintCmd}" -f parsable "${tempFileName}"`, rootPath);
                if (yamllintOutput && yamllintOutput.length > 0) {
                    // Format yamllint output for better readability
                    const formattedOutput = this.formatYamllintOutput(yamllintOutput, tempFileName);
                    diagnostics.push(`📋 yamllint:\n${formattedOutput}`);
                } else {
                    diagnostics.push('✅ yamllint: Ошибок не найдено');
                }
            } catch (err: any) {
                console.error('[IndentFixer] yamllint error:', err);
                if (err.message.includes('not found') || err.message.includes('не является')) {
                    diagnostics.push('⚠️ yamllint: Не установлен\n   Установите: pip install yamllint');
                } else {
                    diagnostics.push(`⚠️ yamllint: ${err.message}`);
                }
            }

            // Check for ansible-lint (only for ansible/yaml files)
            if (document.languageId === 'ansible' || document.languageId === 'yaml') {
                const hasAnsibleLintConfig = fs.existsSync(path.join(rootPath, '.ansible-lint'));
                console.log(`[IndentFixer] ansible-lint config found: ${hasAnsibleLintConfig}`);
                
                try {
                    const ansibleLintCmd = this.findExecutable('ansible-lint', rootPath);
                    const ansibleLintOutput = await this.runCommand(`"${ansibleLintCmd}" -f pep8 "${tempFileName}"`, rootPath);
                    if (ansibleLintOutput && ansibleLintOutput.length > 0) {
                        // Format ansible-lint output
                        const formattedOutput = this.formatAnsibleLintOutput(ansibleLintOutput, tempFileName);
                        diagnostics.push(`🔍 ansible-lint:\n${formattedOutput}`);
                    } else {
                        diagnostics.push('✅ ansible-lint: Ошибок не найдено');
                    }
                } catch (err: any) {
                    console.error('[IndentFixer] ansible-lint error:', err);
                    if (err.message.includes('not found') || err.message.includes('не является')) {
                        diagnostics.push('⚠️ ansible-lint: Не установлен\n   Установите: pip install ansible ansible-lint');
                    } else if (err.message.includes('No module named') || err.message.includes('CRITICAL')) {
                        diagnostics.push('⚠️ ansible-lint: Требуется ansible\n   Установите: pip install ansible ansible-lint');
                    } else {
                        diagnostics.push(`⚠️ ansible-lint:\n${err.message}`);
                    }
                }
            }

        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

        return diagnostics;
    }

    private static formatYamllintOutput(output: string, tempFileName: string): string {
        // Remove temp filename and format nicely
        const lines = output.split('\n').filter(line => line.trim());
        const formatted = lines.map(line => {
            // Format: filename:line:col: [severity] message (rule)
            const match = line.match(/^.*?:(\d+):(\d+):\s*\[(\w+)\]\s*(.+?)(\s*\([\w-]+\))?$/);
            if (match) {
                const [, lineNum, col, severity, message, rule] = match;
                const icon = severity === 'error' ? '❌' : '⚠️';
                return `   ${icon} Строка ${lineNum}:${col} - ${message}${rule || ''}`;
            }
            return line.replace(tempFileName, 'файл');
        });
        return formatted.join('\n');
    }

    private static formatAnsibleLintOutput(output: string, tempFileName: string): string {
        // Format ansible-lint output
        const lines = output.split('\n').filter(line => line.trim());
        const formatted = lines.map(line => {
            // Remove temp filename
            const cleaned = line.replace(tempFileName, 'файл');
            // Format: filename:line: [rule] message
            const match = cleaned.match(/^.*?:(\d+):\s*\[?([\w-]+)\]?\s*(.+)$/);
            if (match) {
                const [, lineNum, rule, message] = match;
                return `   ⚠️ Строка ${lineNum}: [${rule}] ${message}`;
            }
            return `   ${cleaned}`;
        });
        return formatted.join('\n');
    }

    private static async runCommand(command: string, cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Добавляем пути для поиска линтеров
            const extraPaths = [
                `${process.env.HOME}/.local/bin`,
                `${cwd}/venv/bin`,
                `${cwd}/../venv/bin`,
                '/usr/local/bin',
                '/usr/bin'
            ].filter(p => p).join(':');
            
            const env = {
                ...process.env,
                PATH: `${extraPaths}:${process.env.PATH}`
            };
            
            cp.exec(command, { cwd, timeout: 30000, env }, (error, stdout, stderr) => {
                // Exit codes:
                // 0 - success, no issues
                // 1 - linter found issues (this is OK, we want to see them)
                // 2 - linter found issues (yamllint uses this)
                // Other codes - real errors (command not found, config error, etc.)
                
                const output = (stdout || stderr).trim();
                
                if (error) {
                    const code = error.code || 0;
                    if (code === 1 || code === 2) {
                        // Linter found issues - this is expected
                        resolve(output);
                        return;
                    }
                    // Real error
                    reject(new Error(`Exit code ${code}: ${output || error.message}`));
                    return;
                }
                
                resolve(output);
            });
        });
    }

    /**
     * Async version that attempts to use pre-commit if available.
     * Falls back to internal heuristic fixText.
     */
    public static async fixTextAsync(text: string, activeEditor: vscode.TextEditor): Promise<string> {
        const document = activeEditor.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Workspace folder not found. Cannot auto-fix without workspace.');
            return text;
        }

        const rootPath = workspaceFolder.uri.fsPath;
        const outputChannel = vscode.window.createOutputChannel('YAML Auto-Fix Debug');
        
        outputChannel.appendLine('=== YAML Auto-Fix Debug ===');
        outputChannel.appendLine(`File: ${document.fileName}`);
        outputChannel.appendLine(`Workspace: ${rootPath}`);
        outputChannel.appendLine('');

        // СТРАТЕГИЯ АВТОИСПРАВЛЕНИЯ:
        // 1. Попробовать pre-commit (если есть конфиг)
        // 2. Попробовать ansible-lint --fix
        // 3. Показать ошибки и предложить исправить вручную

        // 1. Pre-commit (лучший вариант)
        const preCommitConfigPath = path.join(rootPath, '.pre-commit-config.yaml');
        const hasPreCommitConfig = fs.existsSync(preCommitConfigPath);
        
        outputChannel.appendLine(`[1] Checking pre-commit config: ${preCommitConfigPath}`);
        outputChannel.appendLine(`    Exists: ${hasPreCommitConfig}`);
        
        if (hasPreCommitConfig) {
            try {
                outputChannel.appendLine('    Trying pre-commit...');
                console.log('[IndentFixer] Trying pre-commit...');
                const preCommitResult = await this.runPreCommit(text, activeEditor, rootPath);
                
                if (preCommitResult !== text) {
                    outputChannel.appendLine('    ✅ Pre-commit УСПЕШНО исправил файл!');
                    console.log('[IndentFixer] ✅ Pre-commit fixed the file');
                    outputChannel.show();
                    return preCommitResult;
                } else {
                    outputChannel.appendLine('    ⚠️ Pre-commit выполнился, но не внес изменений');
                }
            } catch (err: any) {
                outputChannel.appendLine(`    ❌ Pre-commit ОШИБКА: ${err.message}`);
                console.error('[IndentFixer] Pre-commit failed:', err);
            }
        }

        // 2. ansible-lint --fix
        outputChannel.appendLine('');
        outputChannel.appendLine('[2] Trying ansible-lint --fix...');
        try {
            // ВАЖНО: передаем полный документ, не только выделение!
            const fullDocumentText = activeEditor.document.getText();
            const ansibleLintResult = await this.runAnsibleLintFix(fullDocumentText, document.fileName, rootPath);
            
            if (ansibleLintResult !== fullDocumentText) {
                outputChannel.appendLine('    ✅ ansible-lint --fix УСПЕШНО исправил файл!');
                console.log('[IndentFixer] ✅ ansible-lint fixed the file');
                outputChannel.show();
                return ansibleLintResult;
            } else {
                outputChannel.appendLine('    ⚠️ ansible-lint --fix выполнился, но не внес изменений');
            }
        } catch (err: any) {
            outputChannel.appendLine(`    ❌ ansible-lint --fix ОШИБКА: ${err.message}`);
            console.log('[IndentFixer] ansible-lint --fix not available:', err.message);
        }

        // 3. Показываем что не смогли исправить автоматически
        outputChannel.appendLine('');
        outputChannel.appendLine('=== ИТОГ ===');
        outputChannel.appendLine('❌ Автоматическое исправление не сработало');
        outputChannel.appendLine('');
        outputChannel.appendLine('Возможные причины:');
        outputChannel.appendLine('1. pre-commit не установлен или не настроен');
        outputChannel.appendLine('2. ansible-lint не поддерживает --fix для этого файла');
        outputChannel.appendLine('3. Ошибки слишком сложные для автоисправления');
        outputChannel.appendLine('');
        outputChannel.appendLine('Рекомендации:');
        outputChannel.appendLine('- Посмотрите ошибки yamllint/ansible-lint выше');
        outputChannel.appendLine('- Исправьте отступы вручную по ошибкам');
        outputChannel.appendLine('- Запустите в терминале: pre-commit run --files file.yml');
        outputChannel.show();

        vscode.window.showWarningMessage(
            'Не удалось автоматически исправить. Смотрите "YAML Auto-Fix Debug" в Output.',
            'Показать логи'
        ).then(choice => {
            if (choice === 'Показать логи') {
                outputChannel.show();
            }
        });

        return text; // Возвращаем без изменений
    }

    private static async runAnsibleLintFix(text: string, fileName: string, rootPath: string): Promise<string> {
        const tempFileName = `.temp_fix_${Date.now()}${path.extname(fileName)}`;
        const tempFilePath = path.join(rootPath, tempFileName);

        console.log(`[IndentFixer] Creating temp file: ${tempFilePath}`);
        fs.writeFileSync(tempFilePath, text);

        // Настраиваем PATH для поиска ansible-lint
        const extraPaths = [
            `${process.env.HOME}/.local/bin`,
            `${rootPath}/venv/bin`,
            `${rootPath}/../venv/bin`,
            '/usr/local/bin',
            '/usr/bin'
        ].filter(p => p).join(path.delimiter);
        
        const env = {
            ...process.env,
            PATH: `${extraPaths}${path.delimiter}${process.env.PATH}`
        };

        try {
            const ansibleLintCmd = this.findExecutable('ansible-lint', rootPath);
            
            await new Promise<void>((resolve, reject) => {
                const cmd = `"${ansibleLintCmd}" --fix "${tempFileName}"`;
                console.log(`[IndentFixer] Running: ${cmd}`);
                console.log(`[IndentFixer] Using ansible-lint: ${ansibleLintCmd}`);
                
                cp.exec(cmd, { cwd: rootPath, timeout: 30000, env }, (error, stdout, stderr) => {
                    console.log(`[IndentFixer] ansible-lint stdout:`, stdout);
                    if (stderr) {
                        console.log(`[IndentFixer] ansible-lint stderr:`, stderr);
                    }
                    
                    // ansible-lint --fix может возвращать:
                    // 0 - исправил успешно
                    // 1 - нашел ошибки которые не может исправить
                    // 2 - исправил, но остались неисправимые
                    if (error) {
                        console.log(`[IndentFixer] ansible-lint exit code:`, error.code);
                        if (error.code !== 0 && error.code !== 1 && error.code !== 2) {
                            reject(new Error(`Exit code ${error.code}: ${stderr || error.message}`));
                            return;
                        }
                    }
                    resolve();
                });
            });

            if (!fs.existsSync(tempFilePath)) {
                throw new Error('File disappeared after ansible-lint');
            }

            const fixedText = fs.readFileSync(tempFilePath, 'utf-8');
            console.log(`[IndentFixer] Original text length: ${text.length}`);
            console.log(`[IndentFixer] Fixed text length: ${fixedText.length}`);
            console.log(`[IndentFixer] Returning FULL fixed file from ansible-lint`);
            return fixedText;
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`[IndentFixer] Cleaned up temp file`);
            }
        }
    }

    private static async runPreCommit(text: string, activeEditor: vscode.TextEditor, rootPath: string): Promise<string> {
        const originalDoc = activeEditor.document;
        // Create a temp file IN THE WORKSPACE to ensure pre-commit picks up the config.
        const tempFileName = `.temp_fix_${Date.now()}${path.extname(originalDoc.fileName)}`;
        const tempFilePath = path.join(rootPath, tempFileName);

        // Use the full file content.
        const fullText = originalDoc.getText();

        console.log(`[IndentFixer] Creating temp file: ${tempFilePath}`);
        fs.writeFileSync(tempFilePath, fullText);

        // Настраиваем PATH для поиска pre-commit
        const extraPaths = [
            `${process.env.HOME}/.local/bin`,
            `${rootPath}/venv/bin`,
            `${rootPath}/../venv/bin`,
            '/usr/local/bin',
            '/usr/bin'
        ].filter(p => p).join(path.delimiter);
        
        const env = {
            ...process.env,
            PATH: `${extraPaths}${path.delimiter}${process.env.PATH}`
        };

        try {
            const preCommitCmd = this.findExecutable('pre-commit', rootPath);
            
            // Run pre-commit
            console.log(`[IndentFixer] Running: pre-commit run --files "${tempFileName}" in ${rootPath}`);
            console.log(`[IndentFixer] Using pre-commit: ${preCommitCmd}`);
            const result = await new Promise<{code: number, stdout: string, stderr: string}>((resolve, reject) => {
                cp.exec(`"${preCommitCmd}" run --files "${tempFileName}"`, { cwd: rootPath, timeout: 30000, env }, (error, stdout, stderr) => {
                    const exitCode = error ? error.code || 0 : 0;
                    console.log(`[IndentFixer] pre-commit stdout:`, stdout);
                    console.log(`[IndentFixer] pre-commit stderr:`, stderr);
                    console.log(`[IndentFixer] pre-commit exit code:`, exitCode);
                    
                    // pre-commit returns exit codes:
                    // 0 - success, no changes needed
                    // 1 - files were modified (SUCCESS!)
                    // 3 - config error or hook failed
                    // 127 - command not found

                    if (exitCode === 127) {
                        reject(new Error(`Pre-commit не найден: ${stderr || stdout || error?.message}`));
                        return;
                    }
                    
                    if (exitCode > 1 && exitCode !== 1) {
                        reject(new Error(`Pre-commit failed (код ${exitCode}): ${stderr || stdout || error?.message}`));
                        return;
                    }
                    
                    // Exit code 0 or 1 - both OK
                    resolve({code: exitCode, stdout, stderr});
                });
            });
            
            console.log(`[IndentFixer] Pre-commit completed with code ${result.code}`);
            
            // Store pre-commit output for display
            IndentFixer._lastPreCommitOutput = {
                code: result.code,
                stdout: result.stdout,
                stderr: result.stderr
            };
            
            // Add to output channel
            const outputChannel = vscode.window.createOutputChannel('YAML Auto-Fix Debug');
            outputChannel.appendLine(`Pre-commit exit code: ${result.code}`);
            outputChannel.appendLine(`Pre-commit output:`);
            outputChannel.appendLine(result.stdout);
            if (result.stderr) {
                outputChannel.appendLine(`Pre-commit stderr:`);
                outputChannel.appendLine(result.stderr);
            }

            if (!fs.existsSync(tempFilePath)) {
                throw new Error('Temp file disappeared');
            }

            // Read back the file
            const fixedFullText = fs.readFileSync(tempFilePath, 'utf-8');
            const originalFullText = activeEditor.document.getText();
            
            console.log(`[IndentFixer] Original file size: ${originalFullText.length} bytes`);
            console.log(`[IndentFixer] Fixed file size: ${fixedFullText.length} bytes`);
            console.log(`[IndentFixer] Files are ${fixedFullText === originalFullText ? 'IDENTICAL' : 'DIFFERENT'}`);
            
            outputChannel.appendLine(`Original file size: ${originalFullText.length} bytes`);
            outputChannel.appendLine(`Fixed file size: ${fixedFullText.length} bytes`);
            outputChannel.appendLine(`Files changed: ${fixedFullText === originalFullText ? 'NO' : 'YES'}`);

            // Check if there's a selection
            const hasSelection = !activeEditor.selection.isEmpty;
            
            console.log(`[IndentFixer] Selection: ${hasSelection ? 'YES' : 'NO'}`);
            console.log(`[IndentFixer] Original text length: ${text.length}`);
            console.log(`[IndentFixer] Fixed text length: ${fixedFullText.length}`);

            if (hasSelection) {
                // Return only the fixed selection
                const startPos = activeEditor.selection.start;
                const endPos = activeEditor.selection.end;
                const fixedLines = fixedFullText.split(/\r?\n/);
                
                if (endPos.line < fixedLines.length) {
                    const selectedFixedLines = fixedLines.slice(startPos.line, endPos.line + 1);
                    const result = selectedFixedLines.join('\n');
                    console.log(`[IndentFixer] Returning fixed SELECTION (${result.length} chars)`);
                    return result;
                }
            }
            
            // No selection or full file - return entire fixed file
            console.log(`[IndentFixer] Returning FULL fixed file (${fixedFullText.length} chars)`);
            return fixedFullText;

        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`[IndentFixer] Cleaned up temp file`);
            }
        }
    }

    /**
     * Fallback алгоритм - используется только если pre-commit не сработал.
     * В идеале всегда должен использоваться pre-commit/yamllint!
     */
    public static fixText(text: string): string {
        // Простейший fallback - возвращаем как есть
        // Все исправления должны делать профессиональные инструменты!
        return text;
    }

    /**
     * УСТАРЕВШИЙ fallback алгоритм - не используется
     */
    private static fixTextLegacy(text: string): string {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) {
            return text;
        }

        // Используем yamllint для исправления - он знает правила!
        // Но если его нет, используем простой алгоритм

        const fixedLines: string[] = [];
        const indentStack: number[] = []; // Стек отступов для контекста

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Пустые строки и комментарии - как есть
            if (!trimmed || trimmed.startsWith('#')) {
                fixedLines.push(line);
                continue;
            }

            const isListItem = /^-\s+/.test(trimmed);
            const hasColon = /:/.test(trimmed);
            const endsWithColon = trimmed.endsWith(':');
            const currentIndent = (line.match(/^(\s*)/) || ['', ''])[1].length;

            let targetIndent = 0;

            // --- в начале файла
            if (i === 0 && trimmed === '---') {
                targetIndent = 0;
                indentStack.length = 0;
                indentStack.push(0);
            }
            // Playbook top-level: "- name:" или "- hosts:"
            else if (isListItem && indentStack.length === 1) {
                targetIndent = 0;
                indentStack.length = 1;
                indentStack.push(2); // Следующий уровень - 2
            }
            // Ключи playbook level (hosts, become, vars, tasks и т.д.)
            else if (endsWithColon && !isListItem && indentStack.length === 2) {
                targetIndent = 2;
                // tasks/handlers открывают список - следующий indent = 4
                if (/^(tasks|handlers|pre_tasks|post_tasks):/.test(trimmed)) {
                    indentStack.length = 2;
                    indentStack.push(4); // List items будут с 4
                } else {
                    // vars, etc - содержимое с indent 4
                    indentStack.length = 2;
                    indentStack.push(4);
                }
            }
            // List item в tasks (- name: ...)
            else if (isListItem && indentStack.length > 2 && indentStack[indentStack.length - 1] === 4) {
                targetIndent = 4;
                indentStack.length = 3;
                indentStack.push(6); // Модули внутри задачи - 6
            }
            // Модуль после "- name:" (apt:, copy:, и т.д.)
            else if (endsWithColon && indentStack[indentStack.length - 1] === 6) {
                targetIndent = 6;
                indentStack.length = 4;
                indentStack.push(8); // Параметры модуля - 8
            }
            // Параметры (name:, state:, и т.д.)
            else if (hasColon && indentStack.length > 0) {
                targetIndent = indentStack[indentStack.length - 1];
            }
            // Значения в списках
            else if (isListItem && indentStack.length > 0) {
                targetIndent = indentStack[indentStack.length - 1];
            }
            // По умолчанию - текущий уровень
            else {
                targetIndent = indentStack.length > 0 ? indentStack[indentStack.length - 1] : 0;
            }

            // Dedent detection - если отступ явно меньше
            if (currentIndent < (indentStack.length > 1 ? indentStack[indentStack.length - 2] : 0)) {
                // Возврат на предыдущий уровень
                while (indentStack.length > 1 && indentStack[indentStack.length - 1] > currentIndent) {
                    indentStack.pop();
                }
                targetIndent = indentStack.length > 0 ? indentStack[indentStack.length - 1] : 0;
            }

            fixedLines.push(' '.repeat(targetIndent) + trimmed);
        }

        return fixedLines.join('\n');
    }
}
