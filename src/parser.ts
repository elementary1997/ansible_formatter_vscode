/**
 * Parser - парсинг вывода ansible-lint и pre-commit
 */

import * as path from 'path';
import { LintError, LintResult } from './models/lintError';

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
        
        const lines = stdout.split('\n');
        let currentFile = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Формат 1: Путь к файлу (начало блока ошибок)
            // test_extension/main.yml
            if (line && !line.startsWith(' ') && (line.endsWith('.yml') || line.endsWith('.yaml'))) {
                currentFile = line.trim();
                continue;
            }
            
            // Формат 2: Ошибки yamllint
            // 19:5       error    Syntax error: expected <block end>, but found '?' (syntax)
            const yamlLintMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)(\s+\(([^)]+)\))?$/);
            if (yamlLintMatch && currentFile) {
                const [, lineNum, col, severity, message, , rule] = yamlLintMatch;
                const filePath = path.isAbsolute(currentFile) ? currentFile : path.join(workspaceRoot, currentFile);
                
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
            }
        }
        
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
        format?: 'json' | 'pep8' | 'pre-commit'
    ): LintError[] {
        if (!result.stdout || result.stdout.trim() === '') {
            return [];
        }
        
        // Автоопределение формата если не указан
        if (!format) {
            if (result.stdout.trim().startsWith('[') || result.stdout.trim().startsWith('{')) {
                format = 'json';
            } else if (result.stdout.includes('hook:')) {
                format = 'pre-commit';
            } else {
                format = 'pep8';
            }
        }
        
        let errors: LintError[] = [];
        
        switch (format) {
            case 'json':
                errors = this.parseAnsibleLintJson(result.stdout, workspaceRoot);
                break;
            case 'pep8':
                errors = this.parseAnsibleLintPep8(result.stdout, workspaceRoot);
                break;
            case 'pre-commit':
                errors = this.parsePreCommit(result.stdout, workspaceRoot);
                break;
        }
        
        // Обновляем result
        result.errors = errors;
        
        return errors;
    }
}
