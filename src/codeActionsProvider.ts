/**
 * CodeActionsProvider - Quick Fix меню
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { QuickFixer } from './quickFixer';
import { LintError } from './models/lintError';
import { getLastCheckType } from './extension';

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
 * Команда для игнорирования правила - добавляет в соответствующий конфиг
 * @param rule - имя правила
 * @param source - источник правила (yamllint, ansible-lint, pre-commit)
 */
export async function ignoreRule(rule: string, source?: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    try {
        // Определяем какой файл редактировать в зависимости от источника
        if (source === 'yamllint') {
            await ignoreYamllintRule(workspaceRoot, rule);
        } else if (source === 'pre-commit') {
            vscode.window.showInformationMessage(
                `Pre-commit rules cannot be ignored via config. Edit .pre-commit-config.yaml manually to disable hook "${rule}".`
            );
            return;
        } else {
            // По умолчанию ansible-lint
            await ignoreAnsibleLintRule(workspaceRoot, rule);
        }

        // Перезапускаем проверку того же типа что была до этого
        const checkType = getLastCheckType();
        if (checkType === 'all') {
            await vscode.commands.executeCommand('ansible-lint.runAll');
        } else {
            await vscode.commands.executeCommand('ansible-lint.run');
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to update config: ${error.message}`);
    }
}

/**
 * Добавляет правило в .yamllint ignore
 */
async function ignoreYamllintRule(workspaceRoot: string, rule: string): Promise<void> {
    const yamllintPath = path.join(workspaceRoot, '.yamllint');

    let content = '';

    if (fs.existsSync(yamllintPath)) {
        content = fs.readFileSync(yamllintPath, 'utf8');
    } else {
        // Создаем базовый конфиг с исключениями
        content = `---
extends: default

rules:

# Ignore patterns
ignore: |
  .git/
  .venv/
  venv/
  __pycache__/
  *.pyc
  .tox/
  .cache/
  .pytest_cache/
  .mypy_cache/
  dist/
  build/
  *.egg-info/
  node_modules/
  .vscode/
  .idea/
  .yamllint
  .ansible-lint
  .pre-commit-config.yaml
`;
    }

    // Проверяем есть ли секция rules
    if (!content.includes('rules:')) {
        content += '\nrules:\n';
    }

    // Проверяем не отключено ли уже правило
    const ruleDisabledPattern = new RegExp(`${rule}:\\s*(disable|false)`, 'i');
    if (ruleDisabledPattern.test(content)) {
        vscode.window.showInformationMessage(`Rule ${rule} is already disabled in .yamllint`);
        return;
    }

    // Добавляем правило в секцию rules как disabled
    // Находим позицию после "rules:" и добавляем туда
    const rulesMatch = content.match(/rules:\s*\n/);
    if (rulesMatch) {
        const insertPos = rulesMatch.index! + rulesMatch[0].length;
        content = content.slice(0, insertPos) + `  ${rule}: disable\n` + content.slice(insertPos);
    } else {
        content += `  ${rule}: disable\n`;
    }

    fs.writeFileSync(yamllintPath, content, 'utf8');
    vscode.window.showInformationMessage(`Rule ${rule} disabled in .yamllint`);
}

/**
 * Добавляет правило в .ansible-lint skip_list
 */
async function ignoreAnsibleLintRule(workspaceRoot: string, rule: string): Promise<void> {
    const ansibleLintPath = path.join(workspaceRoot, '.ansible-lint');

    let content = '';

    if (fs.existsSync(ansibleLintPath)) {
        content = fs.readFileSync(ansibleLintPath, 'utf8');
    } else {
        content = `---
profile: production

# Excluded paths - служебные папки и конфиги
exclude_paths:
  - .ansible/
  - .cache/
  - .git/
  - .github/
  - .vscode/
  - .idea/
  - __pycache__/
  - "*.egg-info/"
  - venv/
  - .venv/
  - env/
  - node_modules/
  - out/
  - dist/
  - build/
  - docs/
  - "*.md"
  - .yamllint
  - .ansible-lint
  - .pre-commit-config.yaml

skip_list:
`;
    }

    if (!content.includes('skip_list:')) {
        content += '\nskip_list:\n';
    }

    // Извлекаем имя правила
    const ruleMatch = rule.match(/^([^[]+)\[?([^\]]*)\]?$/);
    const ruleName = ruleMatch && ruleMatch[2] ? `${ruleMatch[1]}[${ruleMatch[2]}]` : rule;

    if (content.includes(`- ${ruleName}`)) {
        vscode.window.showInformationMessage(`Rule ${ruleName} is already in .ansible-lint skip_list`);
        return;
    }

    content += `  - ${ruleName}\n`;

    fs.writeFileSync(ansibleLintPath, content, 'utf8');
    vscode.window.showInformationMessage(`Rule ${ruleName} added to .ansible-lint skip_list`);
}
