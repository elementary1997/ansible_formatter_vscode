/**
 * Extension.ts - главный файл расширения
 */

import * as vscode from 'vscode';
import { Executor } from './executor';
import { Parser } from './parser';
import { DiagnosticsProvider } from './diagnosticsProvider';
import { CodeActionsProvider, ignoreRule } from './codeActionsProvider';
import { WebviewPanel } from './webviewPanel';
import { AnsibleLintFixer } from './ansibleLintFixer';
import { QuickFixer } from './quickFixer';

let diagnosticsProvider: DiagnosticsProvider;
let webviewPanel: WebviewPanel;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Ansible Lint Helper is now active!');
    
    // Инициализация провайдеров
    diagnosticsProvider = new DiagnosticsProvider();
    webviewPanel = new WebviewPanel(context.extensionUri);
    
    // Регистрация Webview Provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WebviewPanel.viewType,
            webviewPanel
        )
    );
    
    // Регистрация Code Actions Provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            ['yaml', 'ansible'],
            new CodeActionsProvider(),
            {
                providedCodeActionKinds: CodeActionsProvider.providedCodeActionKinds
            }
        )
    );
    
    // Создание Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.text = '$(play) Run Ansible Lint';
    statusBarItem.command = 'ansible-lint.run';
    statusBarItem.tooltip = 'Run ansible-lint on current file';
    context.subscriptions.push(statusBarItem);
    
    // Показываем кнопку только для YAML/Ansible файлов
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && (editor.document.languageId === 'yaml' || editor.document.languageId === 'ansible')) {
                statusBarItem.show();
            } else {
                statusBarItem.hide();
            }
        })
    );
    
    // Показываем кнопку если текущий файл - YAML
    if (vscode.window.activeTextEditor) {
        const doc = vscode.window.activeTextEditor.document;
        if (doc.languageId === 'yaml' || doc.languageId === 'ansible') {
            statusBarItem.show();
        }
    }
    
    // Регистрация команд
    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.run', runAnsibleLintOnCurrentFile)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.runAll', runAnsibleLintOnAllFiles)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.runPreCommit', runPreCommit)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.fixCurrent', fixCurrentFile)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.fixWithTool', fixWithTool)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.ignoreRule', ignoreRule)
    );
    
    // Auto-fix on save (если включено в настройках)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            const config = vscode.workspace.getConfiguration('ansible-lint');
            const autoFix = config.get<boolean>('autoFixOnSave', false);
            
            if (autoFix && (document.languageId === 'yaml' || document.languageId === 'ansible')) {
                await fixCurrentFile();
            }
        })
    );
    
    context.subscriptions.push(diagnosticsProvider);
}

/**
 * Запустить ansible-lint на текущем файле (с pre-commit)
 */
async function runAnsibleLintOnCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }
    
    const document = editor.document;
    const filePath = document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('File is not in a workspace');
        return;
    }
    
    const workspaceRoot = workspaceFolder.uri.fsPath;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Running checks...',
            cancellable: false
        }, async (progress) => {
            const allErrors: any[] = [];
            
            // Шаг 1: Запускаем pre-commit (если доступен)
            progress.report({ increment: 0, message: 'Running pre-commit...' });
            try {
                const preCommitResult = await Executor.runPreCommit(filePath, workspaceRoot);
                const preCommitErrors = Parser.parse(preCommitResult, workspaceRoot, 'pre-commit');
                
                if (preCommitErrors.length > 0) {
                    // Добавляем метаданные о группе
                    preCommitErrors.forEach(error => {
                        error.checkGroup = 'pre-commit';
                    });
                    allErrors.push(...preCommitErrors);
                }
            } catch (error: any) {
                console.log('[Extension] pre-commit not available or failed:', error.message);
            }
            
            progress.report({ increment: 40, message: 'Running ansible-lint...' });
            
            // Шаг 2: Запускаем ansible-lint
            const ansibleResult = await Executor.runAnsibleLint(filePath, workspaceRoot, 'pep8');
            const ansibleErrors = Parser.parse(ansibleResult, workspaceRoot, 'pep8');
            
            if (ansibleErrors.length > 0) {
                // Добавляем метаданные о группе
                ansibleErrors.forEach(error => {
                    error.checkGroup = 'ansible-lint';
                });
                allErrors.push(...ansibleErrors);
            }
            
            progress.report({ increment: 80 });
            
            // Обновляем UI
            diagnosticsProvider.updateDiagnostics(allErrors);
            webviewPanel.updateErrors(allErrors);
            
            progress.report({ increment: 100 });
            
            // Показываем статистику
            if (allErrors.length === 0) {
                vscode.window.showInformationMessage('✓ No errors found');
            } else {
                const errorCount = allErrors.filter(e => e.severity === 'error').length;
                const warningCount = allErrors.filter(e => e.severity === 'warning').length;
                vscode.window.showInformationMessage(
                    `Found ${errorCount} errors and ${warningCount} warnings`
                );
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Linter failed: ${error.message}`);
    }
}

/**
 * Запустить ansible-lint на всех файлах
 */
async function runAnsibleLintOnAllFiles(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Running ansible-lint on all files...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            
            // Запускаем ansible-lint на всех файлах
            const result = await Executor.runAnsibleLintAll(workspaceRoot, 'pep8');
            
            progress.report({ increment: 50 });
            
            // Парсим результаты
            const errors = Parser.parse(result, workspaceRoot, 'pep8');
            
            progress.report({ increment: 75 });
            
            // Обновляем UI
            diagnosticsProvider.updateDiagnostics(errors);
            webviewPanel.updateErrors(errors);
            
            progress.report({ increment: 100 });
            
            // Показываем статистику
            if (errors.length === 0) {
                vscode.window.showInformationMessage('✓ No errors found');
            } else {
                const errorCount = errors.filter(e => e.severity === 'error').length;
                const warningCount = errors.filter(e => e.severity === 'warning').length;
                const filesCount = new Set(errors.map(e => e.file)).size;
                vscode.window.showInformationMessage(
                    `Found ${errorCount} errors and ${warningCount} warnings in ${filesCount} files`
                );
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`ansible-lint failed: ${error.message}`);
    }
}

/**
 * Запустить только pre-commit (без ansible-lint)
 */
async function runPreCommit(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }
    
    const document = editor.document;
    const filePath = document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('File is not in a workspace');
        return;
    }
    
    const workspaceRoot = workspaceFolder.uri.fsPath;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Running pre-commit only...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            
            // Запускаем pre-commit
            const result = await Executor.runPreCommit(filePath, workspaceRoot);
            
            progress.report({ increment: 50 });
            
            // Парсим результаты
            const errors = Parser.parse(result, workspaceRoot, 'pre-commit');
            
            progress.report({ increment: 75 });
            
            // Обновляем UI
            diagnosticsProvider.updateDiagnostics(errors);
            webviewPanel.updateErrors(errors);
            
            progress.report({ increment: 100 });
            
            // Показываем статистику
            if (errors.length === 0) {
                vscode.window.showInformationMessage('✓ pre-commit passed');
            } else {
                const errorCount = errors.filter(e => e.severity === 'error').length;
                const warningCount = errors.filter(e => e.severity === 'warning').length;
                vscode.window.showWarningMessage(`pre-commit: ${errorCount} errors, ${warningCount} warnings`);
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`pre-commit failed: ${error.message}`);
    }
}

/**
 * Исправить текущий файл (гибридный подход)
 */
async function fixCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }
    
    const document = editor.document;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fixing file...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Applying quick fixes...' });
            
            // Шаг 1: Применяем быстрые исправления
            const errors = diagnosticsProvider.getErrorsForFile(document.uri.fsPath);
            const quickEdits = QuickFixer.applyAllQuickFixes(document, errors);
            
            if (quickEdits.length > 0) {
                const edit = new vscode.WorkspaceEdit();
                edit.set(document.uri, quickEdits);
                await vscode.workspace.applyEdit(edit);
            }
            
            progress.report({ increment: 50, message: 'Running ansible-lint --fix...' });
            
            // Шаг 2: Применяем ansible-lint --fix
            await AnsibleLintFixer.fixFile(document);
            
            progress.report({ increment: 100 });
        });
        
        // Перезапускаем проверку
        await runAnsibleLintOnCurrentFile();
        
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to fix file: ${error.message}`);
    }
}

/**
 * Исправить с помощью ansible-lint --fix
 */
async function fixWithTool(uriString?: string): Promise<void> {
    let document: vscode.TextDocument;
    
    if (uriString) {
        // URI передан из Code Action
        const uri = vscode.Uri.parse(uriString);
        document = await vscode.workspace.openTextDocument(uri);
    } else {
        // Вызвано из Command Palette
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        document = editor.document;
    }
    
    try {
        const success = await AnsibleLintFixer.fixFile(document);
        
        if (success) {
            // Перезапускаем проверку
            await runAnsibleLintOnCurrentFile();
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to fix with ansible-lint: ${error.message}`);
    }
}

export function deactivate() {
    if (diagnosticsProvider) {
        diagnosticsProvider.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
