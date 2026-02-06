/**
 * CodeActionsProvider - Quick Fix меню
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { QuickFixer } from './quickFixer';
import { LintError } from './models/lintError';

export class CodeActionsProvider implements vscode.CodeActionProvider {
    
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];
    
    /**
     * Предоставить Code Actions для диагностики
     */
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'ansible-lint' && diagnostic.source !== 'pre-commit') {
                continue;
            }
            
            const rule = diagnostic.code as string;
            const error: LintError = {
                file: document.uri.fsPath,
                line: diagnostic.range.start.line + 1,
                column: diagnostic.range.start.character + 1,
                rule: rule,
                message: diagnostic.message,
                severity: this.severityToString(diagnostic.severity),
                source: diagnostic.source as any
            };
            
            // Действие 1: Быстрое исправление (если доступно)
            if (QuickFixer.hasQuickFix(rule)) {
                const quickFixAction = this.createQuickFixAction(document, error, diagnostic);
                if (quickFixAction) {
                    actions.push(quickFixAction);
                }
            }
            
            // Действие 2: Исправить с помощью ansible-lint --fix
            const ansibleFixAction = this.createAnsibleLintFixAction(document, diagnostic);
            actions.push(ansibleFixAction);
            
            // Действие 3: Игнорировать это правило
            const ignoreAction = this.createIgnoreRuleAction(rule, diagnostic);
            actions.push(ignoreAction);
            
            // Действие 4: Показать документацию
            if (diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0) {
                const docAction = this.createShowDocumentationAction(rule, diagnostic);
                actions.push(docAction);
            }
        }
        
        return actions;
    }
    
    /**
     * Создать Quick Fix действие
     */
    private createQuickFixAction(
        document: vscode.TextDocument,
        error: LintError,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | null {
        const edit = QuickFixer.applyQuickFix(document, error);
        
        if (!edit) {
            return null;
        }
        
        const action = new vscode.CodeAction(
            `⚡ Quick Fix: ${error.rule}`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        action.edit.set(document.uri, [edit]);
        action.diagnostics = [diagnostic];
        action.isPreferred = true; // Показать как предпочтительное действие
        
        return action;
    }
    
    /**
     * Создать действие для ansible-lint --fix
     */
    private createAnsibleLintFixAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '🔧 Fix with ansible-lint --fix',
            vscode.CodeActionKind.QuickFix
        );
        
        action.command = {
            command: 'ansible-lint.fixWithTool',
            title: 'Fix with ansible-lint',
            arguments: [document.uri.toString()]
        };
        action.diagnostics = [diagnostic];
        
        return action;
    }
    
    /**
     * Создать действие для игнорирования правила
     */
    private createIgnoreRuleAction(
        rule: string,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '🚫 Ignore this rule',
            vscode.CodeActionKind.QuickFix
        );
        
        action.command = {
            command: 'ansible-lint.ignoreRule',
            title: 'Ignore rule',
            arguments: [rule]
        };
        action.diagnostics = [diagnostic];
        
        return action;
    }
    
    /**
     * Создать действие для показа документации
     */
    private createShowDocumentationAction(
        rule: string,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '📖 Show documentation',
            vscode.CodeActionKind.QuickFix
        );
        
        // Извлекаем URL из relatedInformation
        const docInfo = diagnostic.relatedInformation?.[0];
        if (docInfo) {
            const urlMatch = docInfo.message.match(/Documentation: (.+)/);
            if (urlMatch) {
                action.command = {
                    command: 'vscode.open',
                    title: 'Show documentation',
                    arguments: [vscode.Uri.parse(urlMatch[1])]
                };
            }
        }
        
        action.diagnostics = [diagnostic];
        
        return action;
    }
    
    /**
     * Преобразовать VSCode DiagnosticSeverity в строку
     */
    private severityToString(severity: vscode.DiagnosticSeverity): 'error' | 'warning' | 'info' {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'error';
            case vscode.DiagnosticSeverity.Warning:
                return 'warning';
            case vscode.DiagnosticSeverity.Information:
            case vscode.DiagnosticSeverity.Hint:
                return 'info';
            default:
                return 'warning';
        }
    }
}

/**
 * Команда для игнорирования правила - добавляет в .ansible-lint
 */
export async function ignoreRule(rule: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const ansibleLintPath = path.join(workspaceRoot, '.ansible-lint');
    
    try {
        let content = '';
        
        // Читаем существующий файл если есть
        if (fs.existsSync(ansibleLintPath)) {
            content = fs.readFileSync(ansibleLintPath, 'utf8');
        } else {
            // Создаем новый файл с базовой структурой
            content = `---
profile: production

exclude_paths:
  - .cache/
  - .github/
  - venv/
  - node_modules/

skip_list:
`;
        }
        
        // Проверяем, есть ли уже skip_list
        if (!content.includes('skip_list:')) {
            content += '\nskip_list:\n';
        }
        
        // Извлекаем имя правила из формата yaml[trailing-spaces]
        const ruleMatch = rule.match(/^([^[]+)\[?([^\]]*)\]?$/);
        const ruleName = ruleMatch ? `${ruleMatch[1]}[${ruleMatch[2]}]` : rule;
        
        // Проверяем, не добавлено ли уже это правило
        if (content.includes(`- ${ruleName}`)) {
            vscode.window.showInformationMessage(`Rule ${ruleName} is already in skip_list`);
            return;
        }
        
        // Добавляем правило в skip_list
        content += `  - ${ruleName}\n`;
        
        // Записываем файл
        fs.writeFileSync(ansibleLintPath, content, 'utf8');
        
        vscode.window.showInformationMessage(`Rule ${ruleName} added to .ansible-lint skip_list`);
        
        // Открываем файл для просмотра
        const doc = await vscode.workspace.openTextDocument(ansibleLintPath);
        await vscode.window.showTextDocument(doc);
        
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to update .ansible-lint: ${error.message}`);
    }
}
