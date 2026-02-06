/**
 * WebviewPanel - боковая панель с отображением ошибок
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LintError } from './models/lintError';

export class WebviewPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ansible-lint.resultsPanel';

    private _view?: vscode.WebviewView;
    private _errors: LintError[] = [];

    // Events
    private _onDidClear = new vscode.EventEmitter<void>();
    public readonly onDidClear = this._onDidClear.event;

    constructor(
        private readonly _extensionUri: vscode.Uri
    ) {}

    /**
     * Resolve webview view
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Восстанавливаем ошибки если они были
        if (this._errors.length > 0) {
            webviewView.webview.postMessage({
                type: 'updateErrors',
                errors: this._serializeErrors(this._errors)
            });
        }

        // Обработка сообщений от webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'gotoError':
                    this._gotoError(data.file, data.line);
                    break;
                case 'fixFile':
                    vscode.commands.executeCommand('ansible-lint.fixWithTool', data.file);
                    break;
                case 'fixAll':
                    vscode.commands.executeCommand('ansible-lint.fixAll');
                    break;
                case 'refresh':
                    vscode.commands.executeCommand('ansible-lint.run');
                    break;
                case 'runAll':
                    vscode.commands.executeCommand('ansible-lint.runAll');
                    break;
                case 'clear':
                    this.clear();
                    this._onDidClear.fire();
                    break;
            }
        });
    }

    /**
     * Обновить список ошибок
     */
    public updateErrors(errors: LintError[]): void {
        this._errors = errors;

        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateErrors',
                errors: this._serializeErrors(errors)
            });
        }
    }

    /**
     * Очистить список ошибок
     */
    public clear(): void {
        this._errors = [];

        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateErrors',
                errors: []
            });
        }
    }

    /**
     * Сериализовать ошибки для отправки в webview
     */
    private _serializeErrors(errors: LintError[]): any[] {
        return errors.map(error => ({
            file: path.basename(error.file),
            fullPath: error.file,
            line: error.line,
            column: error.column,
            rule: error.rule,
            message: error.message,
            severity: error.severity,
            source: error.source,
            fixable: error.fixable,
            checkGroup: (error as any).checkGroup
        }));
    }

    /**
     * Перейти к ошибке в редакторе
     */
    private async _gotoError(file: string, line: number): Promise<void> {
        try {
            const uri = vscode.Uri.file(file);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            const position = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
        }
    }


    /**
     * Получить HTML для webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ansible Lint Results</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .stats {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }

        .buttons {
            display: flex;
            gap: 5px;
        }

        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 0.85em;
            border-radius: 2px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .error-group {
            margin-bottom: 15px;
        }

        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 8px;
            background: var(--vscode-editor-background);
            border-radius: 3px;
            margin-bottom: 5px;
            cursor: pointer;
        }

        .file-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .file-name {
            font-weight: bold;
            font-size: 0.9em;
        }

        .error-count {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
        }

        .error-item {
            padding: 8px 12px;
            margin: 3px 0;
            background: var(--vscode-editor-background);
            border-left: 3px solid var(--vscode-errorForeground);
            cursor: pointer;
            border-radius: 0 3px 3px 0;
        }

        .error-item.warning {
            border-left-color: var(--vscode-editorWarning-foreground);
        }

        .error-item.info {
            border-left-color: var(--vscode-editorInfo-foreground);
        }

        .error-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .error-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3px;
        }

        .error-location {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
        }

        .error-rule {
            font-size: 0.8em;
            color: var(--vscode-textLink-foreground);
            font-family: monospace;
        }

        .error-message {
            font-size: 0.9em;
            margin-top: 3px;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="stats" id="stats">No errors</div>
        <div class="buttons">
            <button onclick="refresh()" title="Run checks on current file">Run</button>
            <button onclick="runAll()" title="Check entire workspace">Check All</button>
            <button onclick="fixAll()" title="Fix all files">Fix All</button>
            <button onclick="clear()" title="Clear results">Clear</button>
        </div>
    </div>

    <div id="errors-container">
        <div class="empty-state">
            <div class="empty-icon">✓</div>
            <div>No errors found</div>
            <div style="font-size: 0.85em; margin-top: 10px;">
                Run ansible-lint to check your files
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Восстанавливаем сохраненное состояние при загрузке
        window.addEventListener('load', () => {
            const state = vscode.getState();
            if (state && state.errors) {
                console.log('[Webview] Restoring state:', state.errors.length, 'errors');
                updateErrorsUI(state.errors);
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;

            if (message.type === 'updateErrors') {
                updateErrorsUI(message.errors);
                // Сохраняем состояние для восстановления
                vscode.setState({ errors: message.errors });
            }
        });

        function updateErrorsUI(errors) {
            const container = document.getElementById('errors-container');
            const stats = document.getElementById('stats');

            if (errors.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-icon">✓</div>
                        <div>No errors found</div>
                    </div>
                \`;
                stats.textContent = 'No errors';
                return;
            }

            // Группируем по файлам
            const errorsByFile = {};
            for (const error of errors) {
                if (!errorsByFile[error.fullPath]) {
                    errorsByFile[error.fullPath] = [];
                }
                errorsByFile[error.fullPath].push(error);
            }

            // Подсчитываем статистику
            let errorCount = 0;
            let warningCount = 0;
            for (const error of errors) {
                if (error.severity === 'error') errorCount++;
                else if (error.severity === 'warning') warningCount++;
            }

            stats.textContent = \`\${errorCount} errors, \${warningCount} warnings\`;

            // Рендерим ошибки
            let html = '';
            for (const [file, fileErrors] of Object.entries(errorsByFile)) {
                const fileName = fileErrors[0].file;
                html += \`
                    <div class="error-group">
                        <div class="file-header" onclick="fixFile('\${file}')">
                            <span class="file-name">📁 \${fileName}</span>
                            <span class="error-count">\${fileErrors.length} issues</span>
                        </div>
                \`;

                // Группируем по checkGroup
                const yamllintErrors = fileErrors.filter(e => e.checkGroup === 'yamllint');
                const preCommitErrors = fileErrors.filter(e => e.checkGroup === 'pre-commit');
                const ansibleErrors = fileErrors.filter(e => e.checkGroup === 'ansible-lint');
                const otherErrors = fileErrors.filter(e => !e.checkGroup);

                // Yamllint ошибки (первые - YAML синтаксис)
                if (yamllintErrors.length > 0) {
                    html += \`
                        <div style="padding: 8px 12px; margin: 8px 0; font-weight: bold; font-size: 0.85em; color: var(--vscode-descriptionForeground); border-top: 1px solid var(--vscode-panel-border); border-bottom: 1px solid var(--vscode-panel-border);">
                            ━━━ YAMLLINT CHECKS ━━━
                        </div>
                    \`;

                    for (const error of yamllintErrors) {
                        html += \`
                            <div class="error-item \${error.severity}" onclick="gotoError('\${error.fullPath}', \${error.line})">
                                <div class="error-header">
                                    <span class="error-location">Line \${error.line}</span>
                                    <span class="error-rule">[\${error.rule}]</span>
                                </div>
                                <div class="error-message">\${escapeHtml(error.message)}</div>
                            </div>
                        \`;
                    }
                }

                // Pre-commit ошибки
                if (preCommitErrors.length > 0) {
                    html += \`
                        <div style="padding: 8px 12px; margin: 8px 0; font-weight: bold; font-size: 0.85em; color: var(--vscode-descriptionForeground); border-top: 1px solid var(--vscode-panel-border); border-bottom: 1px solid var(--vscode-panel-border);">
                            ━━━ PRE-COMMIT CHECKS ━━━
                        </div>
                    \`;

                    for (const error of preCommitErrors) {
                        html += \`
                            <div class="error-item \${error.severity}" onclick="gotoError('\${error.fullPath}', \${error.line})">
                                <div class="error-header">
                                    <span class="error-location">Line \${error.line}</span>
                                    <span class="error-rule">[\${error.rule}]</span>
                                </div>
                                <div class="error-message">\${escapeHtml(error.message)}</div>
                            </div>
                        \`;
                    }
                }

                // Ansible-lint ошибки
                if (ansibleErrors.length > 0) {
                    html += \`
                        <div style="padding: 8px 12px; margin: 8px 0; font-weight: bold; font-size: 0.85em; color: var(--vscode-descriptionForeground); border-top: 1px solid var(--vscode-panel-border); border-bottom: 1px solid var(--vscode-panel-border);">
                            ━━━ ANSIBLE-LINT CHECKS ━━━
                        </div>
                    \`;

                    for (const error of ansibleErrors) {
                        html += \`
                            <div class="error-item \${error.severity}" onclick="gotoError('\${error.fullPath}', \${error.line})">
                                <div class="error-header">
                                    <span class="error-location">Line \${error.line}</span>
                                    <span class="error-rule">[\${error.rule}]</span>
                                </div>
                                <div class="error-message">\${escapeHtml(error.message)}</div>
                            </div>
                        \`;
                    }
                }

                // Ошибки без группы
                for (const error of otherErrors) {
                    html += \`
                        <div class="error-item \${error.severity}" onclick="gotoError('\${error.fullPath}', \${error.line})">
                            <div class="error-header">
                                <span class="error-location">Line \${error.line}</span>
                                <span class="error-rule">[\${error.rule}]</span>
                            </div>
                            <div class="error-message">\${escapeHtml(error.message)}</div>
                        </div>
                    \`;
                }

                html += '</div>';
            }

            container.innerHTML = html;
        }

        function gotoError(file, line) {
            vscode.postMessage({
                type: 'gotoError',
                file: file,
                line: line
            });
        }

        function fixFile(file) {
            vscode.postMessage({
                type: 'fixFile',
                file: file
            });
        }

        function fixAll() {
            vscode.postMessage({
                type: 'fixAll'
            });
        }

        function refresh() {
            vscode.postMessage({
                type: 'refresh'
            });
        }

        function runAll() {
            vscode.postMessage({
                type: 'runAll'
            });
        }

        function clear() {
            vscode.postMessage({
                type: 'clear'
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }
}
