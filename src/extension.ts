/**
 * Extension.ts - главный файл расширения
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { Executor } from './executor';
import { Parser } from './parser';
import { DiagnosticsProvider } from './diagnosticsProvider';
import { CodeActionsProvider, ignoreRule } from './codeActionsProvider';
import { WebviewPanel } from './webviewPanel';
import { AnsibleLintFixer } from './ansibleLintFixer';
import { QuickFixer } from './quickFixer';
import { LintError } from './models/lintError';
import { LintCache } from './cache';

let diagnosticsProvider: DiagnosticsProvider;
let webviewPanel: WebviewPanel;
let statusBarItem: vscode.StatusBarItem;
let extensionContext: vscode.ExtensionContext;
let lastCheckType: 'file' | 'all' = 'file'; // Отслеживаем последний тип проверки
let lintCache: LintCache;

// Экспортируем функцию для получения последнего типа проверки
export function getLastCheckType(): 'file' | 'all' {
    return lastCheckType;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Ansible Lint Helper is now active!');

    // Сохраняем контекст для доступа к workspaceState
    extensionContext = context;

    // Инициализация кэша
    lintCache = LintCache.getInstance();
    lintCache.initialize(context);

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
        vscode.commands.registerCommand('ansible-lint.fixAll', fixAllFiles)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.fixWithTool', fixWithTool)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.ignoreRule', ignoreRule)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.clearCache', () => {
            lintCache.clear();
            vscode.window.showInformationMessage('🗑️ Lint cache cleared');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ansible-lint.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'ansible-lint');
        })
    );

    // Подписка на события webview панели
    context.subscriptions.push(
        webviewPanel.onDidClear(() => {
            diagnosticsProvider.clear();
            lintCache.clear();
            clearSavedState();
        })
    );

    // Восстанавливаем сохраненное состояние
    restoreSavedState();

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
    lastCheckType = 'file'; // Запоминаем тип проверки

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
    const fileContent = document.getText();

    // Проверяем кэш
    const config = vscode.workspace.getConfiguration('ansible-lint');
    const useCache = config.get<boolean>('useCache', true);

    if (useCache && lintCache.hasValidCache(filePath, fileContent)) {
        const cachedErrors = lintCache.getCachedErrors(filePath);
        if (cachedErrors) {
            console.log('[Extension] Using cached results for', filePath);
            diagnosticsProvider.updateDiagnostics(cachedErrors);
            webviewPanel.updateErrors(cachedErrors);
            vscode.window.showInformationMessage('📦 Using cached results (file unchanged)');
            return;
        }
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Running checks...',
            cancellable: false
        }, async (progress) => {
            const allErrors: any[] = [];

            // Получаем настройки линтеров
            const enableYamllint = config.get<boolean>('enableYamllint', true);
            const enablePreCommit = config.get<boolean>('enablePreCommit', true);
            const enableAnsibleLint = config.get<boolean>('enableAnsibleLint', true);

            // Шаг 1: Запускаем yamllint (YAML синтаксис - самый первый)
            if (enableYamllint) {
                progress.report({ increment: 0, message: 'Running yamllint...' });
                try {
                    const yamllintResult = await Executor.runYamllint(filePath, workspaceRoot);
                    const yamllintErrors = Parser.parse(yamllintResult, workspaceRoot, 'yamllint');

                    if (yamllintErrors.length > 0) {
                        // Добавляем метаданные о группе
                        yamllintErrors.forEach(error => {
                            error.checkGroup = 'yamllint';
                        });
                        allErrors.push(...yamllintErrors);
                    }
                } catch (error: any) {
                    console.log('[Extension] yamllint not available or failed:', error.message);
                }
            }

            progress.report({ increment: 20, message: 'Running pre-commit...' });

            // Шаг 2: Запускаем pre-commit (если включен)
            if (enablePreCommit) {
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
            }

            progress.report({ increment: 50, message: 'Running ansible-lint...' });

            // Шаг 3: Запускаем ansible-lint (если включен)
            if (enableAnsibleLint) {
                const ansibleResult = await Executor.runAnsibleLint(filePath, workspaceRoot, 'pep8');
                const ansibleErrors = Parser.parse(ansibleResult, workspaceRoot, 'pep8');

                if (ansibleErrors.length > 0) {
                    // Фильтруем load-failure ошибки если уже есть syntax ошибки от yamllint
                    const hasYamlSyntaxErrors = allErrors.some(e =>
                        e.source === 'yamllint' && e.rule === 'syntax'
                    );

                    const filteredAnsibleErrors = hasYamlSyntaxErrors
                        ? ansibleErrors.filter(e => !e.rule.includes('load-failure'))
                        : ansibleErrors;

                    // Добавляем метаданные о группе
                    filteredAnsibleErrors.forEach(error => {
                        error.checkGroup = 'ansible-lint';
                    });
                    allErrors.push(...filteredAnsibleErrors);
                }
            }

            progress.report({ increment: 90 });

            // Обновляем UI
            diagnosticsProvider.updateDiagnostics(allErrors);
            webviewPanel.updateErrors(allErrors);

            // Сохраняем в кэш
            lintCache.setCacheEntry(filePath, fileContent, allErrors);

            // Сохраняем состояние для восстановления после перезапуска
            saveState(allErrors);

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
    lastCheckType = 'all'; // Запоминаем тип проверки

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Running all checks on workspace...',
            cancellable: false
        }, async (progress) => {
            const allErrors: any[] = [];

            // Получаем настройки линтеров
            const config = vscode.workspace.getConfiguration('ansible-lint');
            const enableYamllint = config.get<boolean>('enableYamllint', true);
            const enablePreCommit = config.get<boolean>('enablePreCommit', true);
            const enableAnsibleLint = config.get<boolean>('enableAnsibleLint', true);

            // Шаг 1: Запускаем yamllint на всех файлах
            if (enableYamllint) {
                progress.report({ increment: 0, message: 'Running yamllint...' });
                try {
                    const yamllintResult = await Executor.runYamllintAll(workspaceRoot);
                    const yamllintErrors = Parser.parse(yamllintResult, workspaceRoot, 'yamllint');

                    if (yamllintErrors.length > 0) {
                        yamllintErrors.forEach(error => {
                            error.checkGroup = 'yamllint';
                        });
                        allErrors.push(...yamllintErrors);
                    }
                } catch (error: any) {
                    console.log('[Extension] yamllint not available or failed:', error.message);
                }
            }

            progress.report({ increment: 20, message: 'Running pre-commit...' });

            // Шаг 2: Запускаем pre-commit на всех файлах
            if (enablePreCommit) {
                try {
                    const preCommitResult = await Executor.runPreCommitAll(workspaceRoot);
                    const preCommitErrors = Parser.parse(preCommitResult, workspaceRoot, 'pre-commit');

                    if (preCommitErrors.length > 0) {
                        preCommitErrors.forEach(error => {
                            error.checkGroup = 'pre-commit';
                        });
                        allErrors.push(...preCommitErrors);
                    }
                } catch (error: any) {
                    console.log('[Extension] pre-commit not available or failed:', error.message);
                }
            }

            progress.report({ increment: 50, message: 'Running ansible-lint...' });

            // Шаг 3: Запускаем ansible-lint на всех файлах
            if (enableAnsibleLint) {
                const result = await Executor.runAnsibleLintAll(workspaceRoot, 'pep8');
                const ansibleErrors = Parser.parse(result, workspaceRoot, 'pep8');

                if (ansibleErrors.length > 0) {
                    // Фильтруем load-failure ошибки если уже есть syntax ошибки от yamllint
                    const hasYamlSyntaxErrors = allErrors.some(e =>
                        e.source === 'yamllint' && e.rule === 'syntax'
                    );

                    const filteredAnsibleErrors = hasYamlSyntaxErrors
                        ? ansibleErrors.filter(e => !e.rule.includes('load-failure'))
                        : ansibleErrors;

                    filteredAnsibleErrors.forEach(error => {
                        error.checkGroup = 'ansible-lint';
                    });
                    allErrors.push(...filteredAnsibleErrors);
                }
            }

            progress.report({ increment: 90 });

            // Обновляем UI
            diagnosticsProvider.updateDiagnostics(allErrors);
            webviewPanel.updateErrors(allErrors);

            // Сохраняем состояние для восстановления после перезапуска
            saveState(allErrors);

            progress.report({ increment: 100 });

            // Показываем статистику
            if (allErrors.length === 0) {
                vscode.window.showInformationMessage('✓ No errors found');
            } else {
                const errorCount = allErrors.filter(e => e.severity === 'error').length;
                const warningCount = allErrors.filter(e => e.severity === 'warning').length;
                const filesCount = new Set(allErrors.map(e => e.file)).size;
                vscode.window.showInformationMessage(
                    `Found ${errorCount} errors and ${warningCount} warnings in ${filesCount} files`
                );
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Linting failed: ${error.message}`);
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

            // Сохраняем состояние для восстановления после перезапуска
            saveState(errors);

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

            // Инвалидируем кэш для исправленного файла
            lintCache.invalidate(document.uri.fsPath);

            progress.report({ increment: 100 });
        });

        // Перезапускаем проверку
        await runAnsibleLintOnCurrentFile();

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to fix file: ${error.message}`);
    }
}

/**
 * Исправить все файлы в workspace
 */
async function fixAllFiles(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fixing all files...',
            cancellable: false
        }, async (progress) => {
            // Шаг 1: Запускаем pre-commit (автоматические исправления)
            progress.report({ increment: 0, message: 'Running pre-commit auto-fixes...' });
            try {
                await Executor.runPreCommitAll(workspaceRoot);
                console.log('[Extension] pre-commit auto-fixes applied');
            } catch (error: any) {
                console.log('[Extension] pre-commit not available or failed:', error.message);
            }

            progress.report({ increment: 40, message: 'Running ansible-lint --fix...' });

            // Шаг 2: Запускаем ansible-lint --fix на всех файлах
            try {
                await Executor.runAnsibleLintFixAll(workspaceRoot);
            } catch (error: any) {
                console.log('[Extension] ansible-lint --fix completed with warnings:', error.message);
            }

            // Очищаем кэш после fix all (все файлы могли измениться)
            lintCache.clear();

            progress.report({ increment: 80, message: 'Refreshing...' });

            // Шаг 3: Перезапускаем проверку
            await runAnsibleLintOnAllFiles();

            progress.report({ increment: 100 });
        });

        vscode.window.showInformationMessage('✓ All files fixed!');

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to fix files: ${error.message}`);
    }
}

/**
 * Исправить с помощью ansible-lint --fix
 */
async function fixWithTool(filePathOrUri?: string): Promise<void> {
    let document: vscode.TextDocument;

    if (filePathOrUri) {
        // Может быть либо URI строка, либо file path
        let uri: vscode.Uri;
        try {
            // Пробуем как URI
            uri = vscode.Uri.parse(filePathOrUri);
        } catch {
            // Если не получилось, используем как file path
            uri = vscode.Uri.file(filePathOrUri);
        }
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

/**
 * Сохранить текущее состояние ошибок
 */
function saveState(errors: LintError[]): void {
    try {
        // Сохраняем ошибки в workspaceState (персистентное хранилище для workspace)
        extensionContext.workspaceState.update('lintErrors', errors);
        console.log('[Extension] State saved:', errors.length, 'errors');
    } catch (error: any) {
        console.error('[Extension] Failed to save state:', error.message);
    }
}

/**
 * Восстановить сохраненное состояние
 */
function restoreSavedState(): void {
    try {
        const savedErrors = extensionContext.workspaceState.get<LintError[]>('lintErrors');

        if (savedErrors && savedErrors.length > 0) {
            console.log('[Extension] Restoring state:', savedErrors.length, 'errors');

            // Восстанавливаем ошибки в UI
            diagnosticsProvider.updateDiagnostics(savedErrors);
            webviewPanel.updateErrors(savedErrors);

            vscode.window.showInformationMessage(
                `📋 Restored ${savedErrors.length} linting results from previous session`
            );
        } else {
            console.log('[Extension] No saved state to restore');
        }
    } catch (error: any) {
        console.error('[Extension] Failed to restore state:', error.message);
    }
}

/**
 * Очистить сохраненное состояние
 */
function clearSavedState(): void {
    try {
        extensionContext.workspaceState.update('lintErrors', undefined);
        console.log('[Extension] Saved state cleared');
    } catch (error: any) {
        console.error('[Extension] Failed to clear state:', error.message);
    }
}
