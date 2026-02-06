/**
 * DiagnosticsProvider - отображение inline ошибок в редакторе
 */

import * as vscode from 'vscode';
import { LintError } from './models/lintError';

export class DiagnosticsProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private errorsByFile: Map<string, LintError[]> = new Map();
    
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ansible-lint');
    }
    
    /**
     * Обновить диагностику для файлов
     */
    public updateDiagnostics(errors: LintError[]): void {
        // Группируем ошибки по файлам
        this.errorsByFile.clear();
        
        for (const error of errors) {
            const fileErrors = this.errorsByFile.get(error.file) || [];
            fileErrors.push(error);
            this.errorsByFile.set(error.file, fileErrors);
        }
        
        // Очищаем все предыдущие диагностики
        this.diagnosticCollection.clear();
        
        // Создаем диагностики для каждого файла
        for (const [file, fileErrors] of this.errorsByFile.entries()) {
            const uri = vscode.Uri.file(file);
            const diagnostics = this.createDiagnostics(fileErrors);
            this.diagnosticCollection.set(uri, diagnostics);
        }
    }
    
    /**
     * Создать VSCode Diagnostics из LintError
     */
    private createDiagnostics(errors: LintError[]): vscode.Diagnostic[] {
        // Фильтруем разделители
        return errors
            .filter(error => error.rule !== 'separator')
            .map(error => this.createDiagnostic(error));
    }
    
    /**
     * Создать одну VSCode Diagnostic из LintError
     */
    private createDiagnostic(error: LintError): vscode.Diagnostic {
        // VSCode использует 0-based индексы
        const line = error.line - 1;
        const column = (error.column || 1) - 1;
        
        // Создаем range для ошибки
        const range = new vscode.Range(
            line,
            column,
            line,
            column + 50 // Подчеркиваем 50 символов или до конца строки
        );
        
        // Определяем severity
        let severity: vscode.DiagnosticSeverity;
        switch (error.severity) {
            case 'error':
                severity = vscode.DiagnosticSeverity.Error;
                break;
            case 'warning':
                severity = vscode.DiagnosticSeverity.Warning;
                break;
            case 'info':
                severity = vscode.DiagnosticSeverity.Information;
                break;
            default:
                severity = vscode.DiagnosticSeverity.Warning;
        }
        
        // Создаем diagnostic
        const diagnostic = new vscode.Diagnostic(
            range,
            error.message,
            severity
        );
        
        // Добавляем метаданные
        diagnostic.code = error.rule;
        diagnostic.source = error.source;
        
        // Добавляем связанную информацию
        if (error.documentationUrl) {
            diagnostic.relatedInformation = [
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(
                        vscode.Uri.file(error.file),
                        range
                    ),
                    `Documentation: ${error.documentationUrl}`
                )
            ];
        }
        
        // Добавляем теги
        const tags: vscode.DiagnosticTag[] = [];
        if (error.rule.includes('deprecated')) {
            tags.push(vscode.DiagnosticTag.Deprecated);
        }
        if (tags.length > 0) {
            diagnostic.tags = tags;
        }
        
        return diagnostic;
    }
    
    /**
     * Очистить все диагностики
     */
    public clear(): void {
        this.diagnosticCollection.clear();
        this.errorsByFile.clear();
    }
    
    /**
     * Очистить диагностики для конкретного файла
     */
    public clearFile(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
        this.errorsByFile.delete(uri.fsPath);
    }
    
    /**
     * Получить ошибки для файла
     */
    public getErrorsForFile(file: string): LintError[] {
        return this.errorsByFile.get(file) || [];
    }
    
    /**
     * Получить все ошибки
     */
    public getAllErrors(): LintError[] {
        const allErrors: LintError[] = [];
        for (const errors of this.errorsByFile.values()) {
            allErrors.push(...errors);
        }
        return allErrors;
    }
    
    /**
     * Dispose
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
