/**
 * Модель ошибки линтера
 * Унифицированное представление ошибок из разных источников (ansible-lint, pre-commit)
 */

export interface LintError {
    /** Путь к файлу с ошибкой */
    file: string;
    
    /** Номер строки (начинается с 1) */
    line: number;
    
    /** Номер колонки (начинается с 1, опционально) */
    column?: number;
    
    /** Код/ID правила (например: yaml[trailing-spaces], name[missing]) */
    rule: string;
    
    /** Сообщение об ошибке */
    message: string;
    
    /** Уровень серьезности */
    severity: 'error' | 'warning' | 'info';
    
    /** Источник ошибки */
    source: 'ansible-lint' | 'pre-commit' | 'yamllint';
    
    /** Можно ли исправить автоматически */
    fixable?: boolean;
    
    /** URL документации правила */
    documentationUrl?: string;
    
    /** Группа проверки (для разделителей) */
    checkGroup?: 'yamllint' | 'pre-commit' | 'ansible-lint';
}

/**
 * Результат выполнения линтера
 */
export interface LintResult {
    /** Список ошибок */
    errors: LintError[];
    
    /** Код выхода команды */
    exitCode: number;
    
    /** Вывод stdout */
    stdout: string;
    
    /** Вывод stderr */
    stderr: string;
    
    /** Время выполнения в миллисекундах */
    executionTime: number;
}
