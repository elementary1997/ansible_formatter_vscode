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
                    documentationUrl: this.getDocumentationUrl(rule)
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
                    documentationUrl: this.getDocumentationUrl(rule)
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
                
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10),
                    rule: lastRule,
                    message: `${lastMessage}: ${details.trim()}`,
                    severity: 'warning',
                    source: 'ansible-lint',
                    fixable: this.isFixable(lastRule),
                    documentationUrl: this.getDocumentationUrl(lastRule)
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
        
        console.log('[Parser] Pre-commit output:', stdout);
        
        const lines = stdout.split('\n');
        let currentFile = '';
        let currentHook = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Формат 0: Название хука и статус
            // Check for merge conflicts........................................Passed
            // yamllint.............................................................Failed
            const hookMatch = line.match(/^(.+?)\.*\s*(Passed|Failed|Skipped)$/);
            if (hookMatch) {
                currentHook = hookMatch[1].trim();
                console.log('[Parser] Hook:', currentHook, 'status:', hookMatch[2]);
                continue;
            }
            
            // Формат 1: Путь к файлу (начало блока ошибок)
            // test_extension/main.yml
            if (line && !line.startsWith(' ') && !line.startsWith('-') && (line.endsWith('.yml') || line.endsWith('.yaml') || line.includes('.yml:') || line.includes('.yaml:'))) {
                const fileMatch = line.match(/^([^:]+\.(yml|yaml))/);
                if (fileMatch) {
                    currentFile = fileMatch[1].trim();
                    console.log('[Parser] Found file:', currentFile);
                    continue;
                }
            }
            
            // Формат 2: Ошибки yamllint
            // 19:5       error    Syntax error: expected <block end>, but found '?' (syntax)
            const yamlLintMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)(\s+\(([^)]+)\))?$/);
            if (yamlLintMatch && currentFile) {
                const [, lineNum, col, severity, message, , rule] = yamlLintMatch;
                const filePath = path.isAbsolute(currentFile) ? currentFile : path.join(workspaceRoot, currentFile);
                
                console.log('[Parser] yamllint error:', {lineNum, col, severity, message, rule});
                
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10),
                    rule: rule || 'yamllint',
                    message: message.trim(),
                    severity: severity === 'error' ? 'error' : 'warning',
                    source: 'pre-commit',
                    fixable: false,
                    documentationUrl: undefined
                });
                continue;
            }
            
            // Формат 3: Стандартный формат ansible-lint в pre-commit
            // main.yml:12:1: [yaml[trailing-spaces]] Trailing spaces
            const ansibleMatch = line.match(/^(.+?):(\d+):(\d+):\s*\[?([^\]]+)\]?\s*(.+)$/);
            if (ansibleMatch) {
                const [, file, lineNum, col, rule, message] = ansibleMatch;
                const filePath = path.isAbsolute(file) ? file : path.join(workspaceRoot, file);
                
                console.log('[Parser] ansible-lint error:', {file, lineNum, col, rule, message});
                
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10),
                    rule: rule.trim(),
                    message: message.trim(),
                    severity: 'warning',
                    source: 'pre-commit',
                    fixable: this.isFixable(rule),
                    documentationUrl: this.getDocumentationUrl(rule)
                });
                continue;
            }
            
            // Формат 4: Ошибки trailing-whitespace и других хуков
            // Файл с trailing-whitespace (но без указания строки)
            if (line.startsWith('-') || (currentFile && line.trim() === '')) {
                continue;
            }
            
            // Формат 5: Загрузка failed в формате ansible-lint
            // load-failure: Failed to load or parse file
            const loadMatch = line.match(/^([a-z-]+):\s*(.+)$/i);
            if (loadMatch && currentFile && currentHook.toLowerCase().includes('ansible')) {
                const [, rule, message] = loadMatch;
                const filePath = path.isAbsolute(currentFile) ? currentFile : path.join(workspaceRoot, currentFile);
                
                console.log('[Parser] load error:', {rule, message});
                
                errors.push({
                    file: filePath,
                    line: 1,
                    column: 1,
                    rule: rule.trim(),
                    message: message.trim(),
                    severity: 'error',
                    source: 'pre-commit',
                    fixable: false,
                    documentationUrl: this.getDocumentationUrl(rule)
                });
            }
        }
        
        console.log('[Parser] Total pre-commit errors found:', errors.length);
        
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
                    documentationUrl: `https://yamllint.readthedocs.io/en/stable/rules.html#module-yamllint.rules.${rule.trim()}`
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
     * Получает URL документации для правила
     */
    private static getDocumentationUrl(rule: string): string | undefined {
        // Извлекаем имя правила из формата yaml[trailing-spaces]
        const ruleMatch = rule.match(/^([^[]+)\[?([^\]]*)\]?$/);
        const ruleName = ruleMatch ? ruleMatch[1] : rule;
        
        // ansible-lint documentation
        return `https://ansible-lint.readthedocs.io/rules/${ruleName}/`;
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
