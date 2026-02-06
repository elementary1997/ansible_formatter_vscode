import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class IndentFixer {

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
                const yamllintOutput = await this.runCommand(`yamllint -f parsable "${tempFileName}"`, workspaceRoot);
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
                const ansibleLintOutput = await this.runCommand(`ansible-lint -f pep8 "${tempFileName}"`, workspaceRoot);
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
                const yamllintOutput = await this.runCommand(`yamllint -f parsable "${tempFileName}"`, rootPath);
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
                    const ansibleLintOutput = await this.runCommand(`ansible-lint -f pep8 "${tempFileName}"`, rootPath);
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

        // 1. Check for pre-commit config (опциональная функция)
        let hasPreCommit = false;
        let preCommitAvailable = false;
        
        if (workspaceFolder) {
            const configPath = path.join(workspaceFolder.uri.fsPath, '.pre-commit-config.yaml');
            if (fs.existsSync(configPath)) {
                hasPreCommit = true;
                console.log(`[IndentFixer] Found pre-commit config at: ${configPath}`);
                
                // Проверяем что pre-commit установлен
                try {
                    await new Promise<void>((resolve, reject) => {
                        cp.exec('pre-commit --version', (error) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve();
                            }
                        });
                    });
                    preCommitAvailable = true;
                    console.log('[IndentFixer] pre-commit is available');
                } catch {
                    console.log('[IndentFixer] pre-commit not found, will use internal fixer');
                }
            } else {
                console.log(`[IndentFixer] No pre-commit config found, using internal fixer`);
            }
        } else {
            console.log('[IndentFixer] No workspace folder found');
        }
        
        hasPreCommit = hasPreCommit && preCommitAvailable;

        if (hasPreCommit && workspaceFolder) {
            try {
                console.log('[IndentFixer] Attempting to run pre-commit...');
                const preCommitResult = await this.runPreCommit(text, activeEditor, workspaceFolder.uri.fsPath);
                // If pre-commit returned the same text, it might mean the hook didn't run or passed.
                // But the user *requested* a fix (specifically looking at the preview).
                // If our internal fixer thinks it needs fixing, maybe we should offer that?
                // OR, simpler: if pre-commit failed to fix it (result == input), try internal.
                if (preCommitResult !== text) {
                    console.log('[IndentFixer] Pre-commit made changes, using result');
                    return preCommitResult;
                }
                console.log('[IndentFixer] Pre-commit made no changes, falling back to internal fixer.');
            } catch (err) {
                console.error('[IndentFixer] Pre-commit execution failed, falling back to internal fixer:', err);
                // Показываем предупреждение так как pre-commit должен быть установлен
                vscode.window.showWarningMessage(
                    'Pre-commit не работает. Убедитесь что он установлен: pip3 install --user pre-commit',
                    'Установить'
                ).then(choice => {
                    if (choice === 'Установить') {
                        vscode.commands.executeCommand('workbench.action.terminal.new');
                    }
                });
            }
        }

        // Fallback or if no pre-commit configuration matches
        console.log('[IndentFixer] Using internal fixer');
        return this.fixText(text);
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

        try {
            // Run pre-commit
            console.log(`[IndentFixer] Running: pre-commit run --files "${tempFileName}" in ${rootPath}`);
            await new Promise<void>((resolve, reject) => {
                cp.exec(`pre-commit run --files "${tempFileName}"`, { cwd: rootPath, timeout: 30000 }, (error, stdout, stderr) => {
                    console.log(`[IndentFixer] pre-commit stdout:`, stdout);
                    if (stderr) {
                        console.log(`[IndentFixer] pre-commit stderr:`, stderr);
                    }
                    
                    // pre-commit returns exit codes:
                    // 0 - success, no changes
                    // 1 - files were modified
                    // 3 - config error or hook failed
                    // Other codes - system errors

                    if (error) {
                        console.log(`[IndentFixer] pre-commit exit code:`, error.code);
                        if (error.code === 1) {
                            // Files were modified - this is OK
                            resolve();
                            return;
                        }
                        // Real error preventing execution
                        const errorMsg = stderr || stdout || error.message;
                        reject(new Error(`Pre-commit failed (код ${error.code}): ${errorMsg}`));
                        return;
                    }
                    resolve();
                });
            });

            if (!fs.existsSync(tempFilePath)) {
                throw new Error('Temp file disappeared');
            }

            // Read back the file
            const fixedFullText = fs.readFileSync(tempFilePath, 'utf-8');

            // Extract the selection
            const startPos = activeEditor.selection.start;
            const endPos = activeEditor.selection.end;

            const fixedLines = fixedFullText.split(/\r?\n/);

            if (endPos.line < fixedLines.length) {
                const selectedFixedLines = fixedLines.slice(startPos.line, endPos.line + 1);
                console.log(`[IndentFixer] Returning fixed text from pre-commit`);
                return selectedFixedLines.join('\n');
            } else {
                console.log(`[IndentFixer] Line range issue, falling back to internal fixer`);
                return this.fixText(text);
            }

        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`[IndentFixer] Cleaned up temp file`);
            }
        }
    }

    /**
     * ПРАВИЛЬНЫЙ алгоритм исправления отступов для YAML/Ansible.
     * Парсит структуру и правильно расставляет отступы по стандартам Ansible.
     */
    public static fixText(text: string): string {
        const lines = text.split(/\r?\n/);
        const fixedLines: string[] = [];

        if (lines.length === 0) {
            return text;
        }

        // Правила YAML/Ansible:
        // 1. Ключи на одном уровне - одинаковый отступ
        // 2. После "key:" дети получают +2 пробела
        // 3. После "- item" (list) дети получают +2 пробела
        // 4. Если "- key: value" то следующие ключи получают +2 от '-'

        let indentLevel = 0; // Текущий уровень отступа в пробелах
        let prevLineType: 'playbook-start' | 'list-item' | 'key-with-colon' | 'key-value' | 'empty' = 'empty';
        let prevIndent = 0;
        let inListContext = false; // Находимся ли внутри списка задач
        let listItemBaseIndent = 0; // Базовый отступ для list items

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const trimmed = rawLine.trim();

            // Пустые строки
            if (trimmed === '') {
                fixedLines.push('');
                prevLineType = 'empty';
                continue;
            }

            // Комментарии - сохраняем с текущим уровнем
            if (trimmed.startsWith('#')) {
                fixedLines.push(' '.repeat(indentLevel) + trimmed);
                continue;
            }

            // Определяем тип строки
            const isListItem = trimmed.startsWith('- ');
            const endsWithColon = trimmed.endsWith(':');
            const isKeyValue = trimmed.includes(':') && !endsWithColon;
            const currentRawIndent = (rawLine.match(/^(\s*)/) || ['', ''])[1].length;

            // ЛОГИКА ОПРЕДЕЛЕНИЯ ОТСТУПА
            let targetIndent = 0;

            // Первая строка (обычно ---)
            if (i === 0) {
                targetIndent = 0;
                fixedLines.push(trimmed);
                prevIndent = 0;
                prevLineType = 'empty';
                indentLevel = 0;
                continue;
            }

            // Специальная обработка для Ansible playbook structure
            // Playbook начинается с "- name:" или "- hosts:"
            if (isListItem && (trimmed.match(/^- name:/) || trimmed.match(/^- hosts:/))) {
                // Это начало playbook entry - всегда отступ 0
                targetIndent = 0;
                inListContext = false;
                listItemBaseIndent = 0;
                indentLevel = 2; // Следующие ключи будут с отступом 2
            }
            // Обработка "tasks:", "vars:", "handlers:" и т.д.
            else if (endsWithColon && !isListItem && prevLineType !== 'list-item') {
                // Проверяем: это ключ на уровне playbook?
                const isPlaybookKey = ['tasks', 'vars', 'handlers', 'pre_tasks', 'post_tasks', 'roles'].some(
                    k => trimmed.startsWith(k + ':')
                );
                
                if (isPlaybookKey && prevIndent === 2) {
                    targetIndent = 2; // Ключи playbook на уровне 2
                    if (trimmed.startsWith('tasks:')) {
                        inListContext = true;
                        listItemBaseIndent = 4; // list items в tasks начинаются с 4
                    }
                    indentLevel = 4; // Дети этого ключа будут на уровне 4
                } else {
                    // Обычный ключ - добавляем 2 к текущему уровню или остаемся на том же
                    if (currentRawIndent < prevIndent) {
                        // Dedent - возвращаемся на уровень выше
                        targetIndent = Math.max(0, prevIndent - 2);
                    } else {
                        targetIndent = prevIndent;
                    }
                    indentLevel = targetIndent + 2;
                }
            }
            // Обработка list items внутри tasks
            else if (isListItem && inListContext) {
                targetIndent = listItemBaseIndent;
                indentLevel = listItemBaseIndent + 2; // Ключи внутри задачи на +2
            }
            // Обработка обычных list items
            else if (isListItem) {
                // Определяем уровень list item
                if (prevLineType === 'key-with-colon') {
                    targetIndent = prevIndent + 2;
                } else {
                    targetIndent = prevIndent;
                }
                indentLevel = targetIndent + 2;
            }
            // Ключи с двоеточием (модули типа "apt:", "copy:")
            else if (endsWithColon) {
                if (prevLineType === 'list-item') {
                    // После "- name:" идет модуль - должен быть на +2 от '-'
                    targetIndent = prevIndent + 2;
                    indentLevel = targetIndent + 2; // Параметры модуля на +2
                } else if (prevLineType === 'key-with-colon') {
                    // Вложенный ключ
                    targetIndent = prevIndent + 2;
                    indentLevel = targetIndent + 2;
                } else {
                    targetIndent = indentLevel;
                    indentLevel = targetIndent + 2;
                }
            }
            // Простые ключи (параметры) 
            else {
                if (prevLineType === 'key-with-colon') {
                    // После модуля с : идут параметры
                    targetIndent = prevIndent + 2;
                } else if (prevLineType === 'list-item') {
                    // После list item
                    targetIndent = prevIndent + 2;
                } else {
                    // Остаемся на текущем уровне
                    targetIndent = indentLevel;
                }
            }

            // Проверка на dedent - если пользователь явно уменьшил отступ
            if (currentRawIndent < prevIndent && !isListItem) {
                // Dedent - корректируем уровень
                targetIndent = Math.max(0, Math.floor(currentRawIndent / 2) * 2);
                indentLevel = targetIndent;
                inListContext = false;
            }

            // Применяем исправленный отступ
            fixedLines.push(' '.repeat(targetIndent) + trimmed);

            // Обновляем состояние
            prevIndent = targetIndent;
            if (isListItem) {
                prevLineType = 'list-item';
            } else if (endsWithColon) {
                prevLineType = 'key-with-colon';
            } else {
                prevLineType = 'key-value';
            }
        }

        return fixedLines.join('\n');
    }
}
