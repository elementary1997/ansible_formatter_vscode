/**
 * Parser - парсинг вывода ansible-lint и pre-commit
 */

import * as path from 'path';
import { LintError, LintResult } from './models/lintError';
import { stripAnsiCodes } from './utils';

export class Parser {

    /**
     * Парсинг JSON вывода ansible-lint
     */
    public static parseAnsibleLintJson(
        stdout: string,
        workspaceRoot: string
    ): LintError[] {
        const errors: LintError[] = [];

        if (!stdout || stdout.trim() === '') {
            return errors;
        }

        // Очищаем ANSI коды
        stdout = stripAnsiCodes(stdout);

        try {
            const results = JSON.parse(stdout);

            if (!Array.isArray(results)) {
                console.error('[Parser] ansible-lint JSON is not an array');
                return errors;
            }

            for (const item of results) {
                // ansible-lint JSON format:
                // {
                //   "type": "issue",
                //   "check_name": "yaml[trailing-spaces]",
                //   "categories": ["formatting"],
                //   "severity": "minor",
                //   "description": "Trailing spaces",
                //   "fingerprint": "...",
                //   "location": {
                //     "path": "main.yml",
                //     "lines": { "begin": 12, "end": 12 }
                //   }
                // }

                if (item.type !== 'issue' && !item.check_name) {
                    continue;
                }

                const filePath = path.join(workspaceRoot, item.location?.path || item.path || '');
                const line = item.location?.lines?.begin || item.line || 1;
                const column = item.location?.columns?.begin || item.column || 1;
                const rule = item.check_name || item.rule?.id || 'unknown';
                const message = item.description || item.message || 'Unknown error';

                // Определяем severity
                let severity: 'error' | 'warning' | 'info' = 'warning';
                if (item.severity === 'major' || item.severity === 'critical') {
                    severity = 'error';
                } else if (item.severity === 'info' || item.severity === 'minor') {
                    severity = item.severity === 'info' ? 'info' : 'warning';
                }

                errors.push({
                    file: filePath,
                    line: line,
                    column: column,
                    rule: rule,
                    message: message,
                    severity: severity,
                    source: 'ansible-lint',
                    fixable: this.isFixable(rule),
                    detailedExplanation: this.getDetailedExplanation(rule, message, 'ansible-lint')
                });
            }
        } catch (error: any) {
            console.error('[Parser] Failed to parse ansible-lint JSON:', error.message);
            // Fallback to pep8 format
            return this.parseAnsibleLintPep8(stdout, workspaceRoot);
        }

        return errors;
    }

    /**
     * Парсинг PEP8 вывода ansible-lint
     */
    public static parseAnsibleLintPep8(
        stdout: string,
        workspaceRoot: string
    ): LintError[] {
        const errors: LintError[] = [];

        if (!stdout || stdout.trim() === '') {
            return errors;
        }

        // Очищаем ANSI коды
        stdout = stripAnsiCodes(stdout);

        // PEP8 format: filename:line:column: [rule] message
        // Example: main.yml:12:1: [yaml[trailing-spaces]] Trailing spaces
        // Special case for load-failure:
        //   load-failure[yaml]: Failed to load YAML file (warning)
        //   main.yml:19:5 did not find expected '-' indicator
        const lines = stdout.split('\n');

        let lastRule = '';
        let lastMessage = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Формат 1: filename:line:column: [rule] message
            const match1 = line.match(/^(.+?):(\d+):(\d+):\s*\[?([^\]]+)\]?\s*(.+)$/);

            if (match1) {
                const [, file, lineNum, col, rule, message] = match1;
                const filePath = path.isAbsolute(file) ? file : path.join(workspaceRoot, file);

                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10),
                    rule: rule.trim(),
                    message: message.trim(),
                    severity: 'warning',
                    source: 'ansible-lint',
                    fixable: this.isFixable(rule),
                    detailedExplanation: this.getDetailedExplanation(rule, message.trim(), 'ansible-lint')
                });
                continue;
            }

            // Формат 2: rule[type]: message (warning/error)
            const match2 = line.match(/^([a-z-]+)\[([^\]]+)\]:\s*(.+?)\s*\((warning|error)\)$/i);

            if (match2) {
                const [, ruleName, ruleType, message] = match2;
                lastRule = `${ruleName}[${ruleType}]`;
                lastMessage = message.trim();
                continue;
            }

            // Формат 3: filename:line:column details (следует за правилом)
            const match3 = line.match(/^(.+?):(\d+):(\d+)\s+(.+)$/);

            if (match3 && lastRule) {
                const [, file, lineNum, col, details] = match3;
                const filePath = path.isAbsolute(file) ? file : path.join(workspaceRoot, file);

                const fullMessage = `${lastMessage}: ${details.trim()}`;
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10),
                    rule: lastRule,
                    message: fullMessage,
                    severity: 'warning',
                    source: 'ansible-lint',
                    fixable: this.isFixable(lastRule),
                    detailedExplanation: this.getDetailedExplanation(lastRule, fullMessage, 'ansible-lint')
                });

                lastRule = '';
                lastMessage = '';
                continue;
            }
        }

        return errors;
    }

    /**
     * Парсинг вывода pre-commit
     */
    public static parsePreCommit(
        stdout: string,
        workspaceRoot: string
    ): LintError[] {
        const errors: LintError[] = [];

        if (!stdout || stdout.trim() === '') {
            return errors;
        }

        // Очищаем ANSI коды
        stdout = stripAnsiCodes(stdout);

        // Нормализуем line endings (Windows \r\n -> Unix \n)
        stdout = stdout.replace(/\r\n/g, '\n');

        console.log('[Parser] Pre-commit parsing started');

        const lines = stdout.split('\n');
        let currentHookId = '';
        let errorContext: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 1. Извлекаем hook id
            const hookIdMatch = line.match(/^-\s+hook\s+id:\s+(.+)$/);
            if (hookIdMatch) {
                currentHookId = hookIdMatch[1].trim();
                errorContext = [];
                console.log(`[Parser] Found hook: ${currentHookId}`);
                continue;
            }

            // 2. Пропускаем служебные строки
            if (line.match(/^-\s+(exit\s+code|files\s+were\s+modified)/)) {
                continue;
            }

            // 3. Формат "Fixing filename"
            const fixingMatch = line.match(/^Fixing\s+(.+)$/);
            if (fixingMatch && currentHookId) {
                const file = fixingMatch[1].trim();

                // Строим полный путь - используем path.resolve для правильной обработки относительных путей
                let filePath: string;
                if (path.isAbsolute(file)) {
                    filePath = file;
                } else {
                    const workspaceBasename = path.basename(workspaceRoot);
                    const fileSegments = file.split(path.sep);

                    if (fileSegments[0] === workspaceBasename) {
                        filePath = path.resolve(path.dirname(workspaceRoot), file);
                    } else {
                        filePath = path.resolve(workspaceRoot, file);
                    }
                }

                console.log(`[Parser] Pre-commit fixing: file="${file}", resolved="${filePath}"`);

                let message = 'File modified';
                if (currentHookId === 'trailing-whitespace') {
                    message = 'Removed trailing whitespace';
                } else if (currentHookId === 'end-of-file-fixer') {
                    message = 'Added newline at end of file';
                } else if (currentHookId === 'mixed-line-ending') {
                    message = 'Fixed mixed line endings';
                }

                errors.push({
                    file: filePath,
                    line: 1,
                    column: 1,
                    rule: currentHookId,
                    message: message,
                    severity: 'info',
                    source: 'pre-commit',
                    fixable: true,
                    detailedExplanation: this.getDetailedExplanation(currentHookId, message, 'pre-commit')
                });

                console.log(`[Parser] Fixing: ${file}`);
                continue;
            }

            // 4. Формат 'in "filename", line X, column Y'
            const locationMatch = line.match(/in\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+column\s+(\d+))?/);
            if (locationMatch && currentHookId) {
                const [, file, lineNum, col] = locationMatch;

                // Строим полный путь - используем path.resolve для правильной обработки относительных путей
                let filePath: string;
                if (path.isAbsolute(file)) {
                    filePath = file;
                } else {
                    // Проверяем, не начинается ли file с последнего сегмента workspaceRoot (избегаем дублирования)
                    const workspaceBasename = path.basename(workspaceRoot);
                    const fileSegments = file.split(path.sep);

                    if (fileSegments[0] === workspaceBasename) {
                        // file уже содержит имя workspace, берем путь от родителя
                        filePath = path.resolve(path.dirname(workspaceRoot), file);
                    } else {
                        // Стандартный случай - относительный путь от workspace root
                        filePath = path.resolve(workspaceRoot, file);
                    }
                }

                console.log(`[Parser] Pre-commit location: file="${file}", workspaceRoot="${workspaceRoot}", resolved="${filePath}"`);

                // Собираем сообщение из накопленного контекста
                const message = errorContext.length > 0
                    ? errorContext.join(' ').trim()
                    : 'YAML syntax error';

                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10) || 1,
                    rule: currentHookId,
                    message: message,
                    severity: 'error',
                    source: 'pre-commit',
                    fixable: false,
                    detailedExplanation: this.getDetailedExplanation(currentHookId, message, 'pre-commit')
                });

                console.log(`[Parser] Error in ${file}:${lineNum} - ${message}`);
                continue;
            }

            // 5. Формат "file.yml: message"
            const fileMessageMatch = line.match(/^([^\s:]+\.(yml|yaml|ts|js|md|json|py)):\s*(.+)$/);
            if (fileMessageMatch && currentHookId) {
                const [, file, , message] = fileMessageMatch;

                // Строим полный путь - используем path.resolve для правильной обработки относительных путей
                let filePath: string;
                if (path.isAbsolute(file)) {
                    filePath = file;
                } else {
                    const workspaceBasename = path.basename(workspaceRoot);
                    const fileSegments = file.split(path.sep);

                    if (fileSegments[0] === workspaceBasename) {
                        filePath = path.resolve(path.dirname(workspaceRoot), file);
                    } else {
                        filePath = path.resolve(workspaceRoot, file);
                    }
                }

                console.log(`[Parser] Pre-commit file message: file="${file}", resolved="${filePath}"`);

                errors.push({
                    file: filePath,
                    line: 1,
                    column: 1,
                    rule: currentHookId,
                    message: message.trim(),
                    severity: 'warning',
                    source: 'pre-commit',
                    fixable: false,
                    detailedExplanation: this.getDetailedExplanation(currentHookId, message.trim(), 'pre-commit')
                });

                console.log(`[Parser] File message: ${file} - ${message}`);
                continue;
            }

            // 6. Накапливаем контекст ошибки (строки описания)
            if (currentHookId && line.trim() && !line.match(/^-/) && !line.match(/\.*\s*(Passed|Failed|Skipped)$/)) {
                errorContext.push(line.trim());
            }

            // 7. Сброс контекста при смене хука
            if (line.match(/\.*\s*(Passed|Failed|Skipped)$/)) {
                errorContext = [];
            }
        }

        console.log(`[Parser] Pre-commit: found ${errors.length} errors`);

        return errors;
    }

    /**
     * Парсинг вывода yamllint (parsable format)
     */
    public static parseYamllint(
        stdout: string,
        workspaceRoot: string
    ): LintError[] {
        const errors: LintError[] = [];

        if (!stdout || stdout.trim() === '') {
            return errors;
        }

        // Очищаем ANSI коды
        stdout = stripAnsiCodes(stdout);

        console.log('[Parser] Yamllint output:', stdout);

        const lines = stdout.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;

            // Формат parsable: filename:line:column: [severity] message (rule)
            // Example: main.yml:19:5: [error] syntax error: expected <block end>, but found '?' (syntax)
            const match = line.match(/^(.+?):(\d+):(\d+):\s*\[(\w+)\]\s*(.+?)\s*\(([^)]+)\)$/);

            if (match) {
                const [, file, lineNum, col, severity, message, rule] = match;
                const filePath = path.isAbsolute(file) ? file : path.join(workspaceRoot, file);

                console.log('[Parser] yamllint error:', {file, lineNum, col, severity, message, rule});

                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10),
                    rule: rule.trim(),
                    message: message.trim(),
                    severity: severity.toLowerCase() === 'error' ? 'error' : 'warning',
                    source: 'yamllint',
                    fixable: false,
                    detailedExplanation: this.getDetailedExplanation(rule.trim(), message.trim(), 'yamllint')
                });
            }
        }

        console.log('[Parser] Total yamllint errors found:', errors.length);

        return errors;
    }

    /**
     * Определяет, можно ли исправить ошибку автоматически
     */
    private static isFixable(rule: string): boolean {
        // Правила, которые ansible-lint может исправить автоматически
        const fixableRules = [
            'yaml[trailing-spaces]',
            'yaml[truthy]',
            'yaml[comments]',
            'yaml[line-length]',
            'name[missing]',
            'name[casing]',
            'jinja[spacing]',
            'key-order',
            'risky-octal'
        ];

        return fixableRules.some(r => rule.includes(r) || r.includes(rule));
    }

    /**
     * Получает подробное объяснение ошибки на русском языке
     */
    private static getDetailedExplanation(rule: string, message: string, source?: string): string {
        // Нормализуем правило для сравнения
        const ruleLower = rule.toLowerCase();

        // Возвращаем русское объяснение в зависимости от правила
        // YAMLLINT правила
        if (ruleLower === 'truthy' || ruleLower.includes('truthy')) {
            return 'Используйте true/false вместо yes/no/on/off';
        } else if (ruleLower === 'line-length' || ruleLower.includes('line-length') || message.includes('line too long')) {
            return 'Строка слишком длинная. Сократите до 150 символов или разбейте на несколько строк';
        } else if (ruleLower === 'indentation' || ruleLower.includes('indentation')) {
            return 'Исправьте отступы: используйте только пробелы (не табы), проверьте количество пробелов';
        } else if (ruleLower === 'syntax' || ruleLower.includes('syntax')) {
            return 'Исправьте структуру YAML файла - проверьте отступы и синтаксис';
        } else if (ruleLower === 'trailing-spaces' || ruleLower.includes('trailing-spaces') || ruleLower.includes('trailing-whitespace')) {
            return 'Удалите пробелы в конце строки';
        } else if (ruleLower === 'empty-lines' || ruleLower.includes('empty-lines')) {
            return 'Проверьте количество пустых строк между блоками';
        } else if (ruleLower === 'new-line-at-end-of-file' || ruleLower.includes('end-of-file')) {
            return 'Добавьте пустую строку в конце файла';
        } else if (ruleLower === 'comments' || ruleLower.includes('comments')) {
            return 'Исправьте формат комментариев (пробел после #)';
        } else if (ruleLower === 'colons' || ruleLower.includes('colons')) {
            return 'Проверьте пробелы вокруг двоеточий (key: value)';
        } else if (ruleLower === 'braces' || ruleLower.includes('braces')) {
            return 'Проверьте пробелы внутри фигурных скобок { }';
        } else if (ruleLower === 'brackets' || ruleLower.includes('brackets')) {
            return 'Проверьте пробелы внутри квадратных скобок [ ]';
        } else if (ruleLower === 'hyphens' || ruleLower.includes('hyphens')) {
            return 'Проверьте пробелы после дефисов в списках';
        } else if (ruleLower === 'document-start' || ruleLower.includes('document-start')) {
            return 'Добавьте "---" в начало файла';
        } else if (ruleLower === 'key-duplicates' || ruleLower.includes('key-duplicates')) {
            return 'Удалите дублирующийся ключ';
        }

        // ANSIBLE-LINT правила
        else if (ruleLower.includes('fqcn')) {
            return 'Используйте полное имя модуля (FQCN), например: ansible.builtin.apt вместо apt';
        } else if (ruleLower.includes('name[missing]')) {
            return 'Добавьте параметр "name:" к задаче для лучшей читаемости';
        } else if (ruleLower.includes('name[casing]')) {
            return 'Имя задачи должно начинаться с заглавной буквы';
        } else if (ruleLower.includes('no-changed-when')) {
            return 'Добавьте "changed_when:" для команд shell/command';
        } else if (ruleLower.includes('risky-file-permissions')) {
            return 'Укажите явные права доступа (mode: "0644")';
        } else if (ruleLower.includes('command-instead-of-shell')) {
            return 'Используйте модуль command вместо shell если не нужны фичи shell';
        } else if (ruleLower.includes('command-instead-of-module')) {
            return 'Используйте специализированный модуль вместо команды';
        } else if (ruleLower.includes('package-latest')) {
            return 'Используйте конкретную версию пакета вместо state: latest';
        } else if (ruleLower.includes('deprecated')) {
            return 'Модуль или синтаксис устарел - используйте новую версию';
        } else if (ruleLower.includes('role-name')) {
            return 'Имя роли должно соответствовать стандартам (lowercase, буквы и цифры)';
        } else if (ruleLower.includes('meta-no-info')) {
            return 'Добавьте meta/main.yml с информацией о роли';
        } else if (ruleLower.includes('var-naming')) {
            return 'Имя переменной должно быть в snake_case';
        } else if (ruleLower.includes('jinja')) {
            return 'Проверьте синтаксис Jinja2 шаблонов ({{ }}, {% %})';
        } else if (ruleLower.includes('yaml')) {
            return 'Исправьте синтаксис YAML';
        }

        // PRE-COMMIT правила
        else if (ruleLower === 'check-yaml') {
            return 'Исправьте структуру YAML файла - проверьте отступы и синтаксис';
        } else if (ruleLower === 'check-merge-conflict') {
            return 'Удалите маркеры конфликта слияния (<<<<, ====, >>>>)';
        } else if (ruleLower === 'mixed-line-ending') {
            return 'Используйте единообразные окончания строк (LF или CRLF)';
        } else if (ruleLower === 'check-case-conflict') {
            return 'Имена файлов различаются только регистром - возможны проблемы на Windows/Mac';
        } else if (ruleLower === 'debug-statements') {
            return 'Удалите отладочные операторы (print, debugger, etc.)';
        }

        // Если правило не распознано - возвращаем undefined (не показываем RU строку)
        return '';
    }

    /**
     * Главный метод парсинга - определяет формат и парсит
     */
    public static parse(
        result: LintResult,
        workspaceRoot: string,
        format?: 'json' | 'pep8' | 'pre-commit' | 'yamllint'
    ): LintError[] {
        // Комбинируем stdout и stderr для более полной информации
        const output = (result.stdout || '') + '\n' + (result.stderr || '');

        if (!output || output.trim() === '') {
            return [];
        }

        // Автоопределение формата если не указан
        if (!format) {
            if (output.trim().startsWith('[') || output.trim().startsWith('{')) {
                format = 'json';
            } else if (output.includes('Passed') || output.includes('Failed') || output.includes('Skipped')) {
                format = 'pre-commit';
            } else {
                format = 'pep8';
            }
        }

        let errors: LintError[] = [];

        switch (format) {
            case 'json':
                errors = this.parseAnsibleLintJson(output, workspaceRoot);
                break;
            case 'pep8':
                errors = this.parseAnsibleLintPep8(output, workspaceRoot);
                break;
            case 'pre-commit':
                errors = this.parsePreCommit(output, workspaceRoot);
                break;
            case 'yamllint':
                errors = this.parseYamllint(output, workspaceRoot);
                break;
        }

        // Обновляем result
        result.errors = errors;

        return errors;
    }
}
