/**
 * WebviewPanel - боковая панель с отображением ошибок
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LintError } from './models/lintError';

export class WebviewPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ansibleLintHelper.resultsView';

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
                    if (data.file) {
                        vscode.commands.executeCommand('ansible-lint.fixWithTool', data.file);
                    } else {
                        vscode.commands.executeCommand('ansible-lint.fixCurrent');
                    }
                    break;
                case 'fixAll':
                    vscode.commands.executeCommand('ansible-lint.fixAll');
                    break;
                case 'ignoreRule':
                    vscode.commands.executeCommand('ansible-lint.ignoreRule', data.rule, data.source);
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
                case 'openSettings':
                    vscode.commands.executeCommand('ansible-lint.openSettings');
                    break;
                case 'clearCache':
                    vscode.commands.executeCommand('ansible-lint.clearCache');
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
            detailedExplanation: error.detailedExplanation,
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

        .settings-btn {
            padding: 5px 8px;
            background: transparent;
            border: 1px solid var(--vscode-button-background);
        }

        .settings-btn:hover {
            background: var(--vscode-button-background);
        }

        .error-lang-line {
            display: flex;
            align-items: baseline;
            gap: 6px;
            font-size: 0.8em;
            line-height: 1.3;
            padding: 1px 0;
        }

        .lang-label {
            flex-shrink: 0;
            font-size: 0.7em;
            font-weight: bold;
            opacity: 0.7;
        }

        .lang-label.eng {
            color: #93c5fd;
        }

        .lang-label.ru {
            color: #fca5a5;
        }

        .error-text {
            color: var(--vscode-editor-foreground);
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
            margin-bottom: 3px;
            cursor: pointer;
            user-select: none;
        }

        .file-header .collapse-icon {
            margin-right: 6px;
            transition: transform 0.2s;
        }

        .file-header.collapsed .collapse-icon {
            transform: rotate(-90deg);
        }

        .file-errors {
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }

        .file-errors.collapsed {
            display: none;
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
            padding: 4px 8px;
            margin: 1px 0;
            background: var(--vscode-list-hoverBackground);
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

        /* Новые стили для улучшенного отображения */
        .error-header-compact {
            display: flex;
            align-items: center;
            margin-bottom: 2px;
            gap: 5px;
            font-size: 0.8em;
        }

        .error-title {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
            cursor: pointer;
            flex-wrap: wrap;
        }

        .severity-icon {
            font-size: 1em;
        }

        .severity-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.7em;
            font-weight: bold;
            letter-spacing: 0.5px;
        }

        .severity-badge.severity-error {
            background: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }

        .severity-badge.severity-warning {
            background: var(--vscode-editorWarning-foreground);
            color: var(--vscode-editor-background);
        }

        .severity-badge.severity-info {
            background: var(--vscode-editorInfo-foreground);
            color: var(--vscode-editor-background);
        }

        .error-source {
            font-size: 0.75em;
            color: var(--vscode-badge-foreground);
            background: var(--vscode-badge-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }

        .error-rule-name {
            font-size: 0.8em;
            color: var(--vscode-textLink-foreground);
            font-family: monospace;
            font-weight: 500;
        }

        .error-location-inline {
            font-size: 0.75em;
            color: var(--vscode-descriptionForeground);
            margin-left: auto;
        }

        .error-description {
            font-size: 0.9em;
            line-height: 1.5;
            cursor: pointer;
            padding: 4px 0;
            color: var(--vscode-foreground);
        }

        .error-detailed-message {
            font-size: 0.8em;
            line-height: 1.3;
            padding: 2px 0;
            color: var(--vscode-foreground);
            white-space: pre-line;
            cursor: pointer;
        }

        .doc-link {
            font-size: 0.75em;
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            padding: 2px 6px;
            border-radius: 3px;
            display: flex;
            align-items: center;
            gap: 3px;
            white-space: nowrap;
        }

        .doc-link:hover {
            background: var(--vscode-list-hoverBackground);
            text-decoration: underline;
        }

        .error-actions {
            display: flex;
            gap: 6px;
            margin-top: 2px;
            flex-wrap: wrap;
        }

        .fixable-badge {
            font-size: 0.75em;
            color: var(--vscode-terminal-ansiGreen);
            background: rgba(0, 255, 0, 0.1);
            padding: 3px 8px;
            border-radius: 3px;
        }

        .ignore-btn {
            font-size: 0.75em;
            color: var(--vscode-terminal-ansiYellow);
            background: rgba(255, 165, 0, 0.1);
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .ignore-btn:hover {
            background: rgba(255, 165, 0, 0.3);
            display: inline-block;
        }

        .filter-bar {
            display: flex;
            gap: 6px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }

        .filter-btn {
            padding: 4px 10px;
            font-size: 0.8em;
            border-radius: 12px;
            cursor: pointer;
            border: 1px solid var(--vscode-button-background);
            background: transparent;
            color: var(--vscode-foreground);
            transition: all 0.2s;
        }

        .filter-btn:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .filter-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .filter-btn.error-filter.active {
            background: var(--vscode-errorForeground);
        }

        .filter-btn.warning-filter.active {
            background: var(--vscode-editorWarning-foreground);
            color: #000;
        }

        .filter-btn.info-filter.active {
            background: var(--vscode-editorInfo-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="stats" id="stats">No errors</div>
        <div class="buttons">
            <button onclick="refresh()" title="Check current file">Check File</button>
            <button onclick="runAll()" title="Check entire workspace">Check All</button>
            <button onclick="fixFile()" title="Fix current file">Fix File</button>
            <button onclick="fixAll()" title="Fix all files">Fix All</button>
            <button onclick="openSettings()" title="Open Settings" class="settings-btn">⚙️</button>
        </div>
    </div>

    <div class="filter-bar" id="filter-bar" style="display: none;">
        <button class="filter-btn active" onclick="setFilter('all')" id="filter-all">All</button>
        <button class="filter-btn error-filter" onclick="setFilter('error')" id="filter-error">❌ Errors</button>
        <button class="filter-btn warning-filter" onclick="setFilter('warning')" id="filter-warning">⚠️ Warnings</button>
        <button class="filter-btn info-filter" onclick="setFilter('info')" id="filter-info">ℹ️ Info</button>
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
        let allErrors = []; // Все ошибки
        let currentFilter = 'all'; // Текущий фильтр

        // Восстанавливаем сохраненное состояние при загрузке
        window.addEventListener('load', () => {
            const state = vscode.getState();
            if (state && state.errors) {
                console.log('[Webview] Restoring state:', state.errors.length, 'errors');
                allErrors = state.errors;
                currentFilter = state.filter || 'all';
                updateFilterButtons();
                updateErrorsUI(allErrors);
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;

            if (message.type === 'updateErrors') {
                allErrors = message.errors;
                updateErrorsUI(allErrors);
                // Сохраняем состояние для восстановления
                vscode.setState({ errors: allErrors, filter: currentFilter });
            }
        });

        function setFilter(filter) {
            currentFilter = filter;
            updateFilterButtons();
            updateErrorsUI(allErrors);
            vscode.setState({ errors: allErrors, filter: currentFilter });
        }

        function updateFilterButtons() {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('filter-' + currentFilter).classList.add('active');
        }

        function filterErrors(errors) {
            if (currentFilter === 'all') return errors;
            if (currentFilter === 'info') {
                return errors.filter(e => e.severity !== 'error' && e.severity !== 'warning');
            }
            return errors.filter(e => e.severity === currentFilter);
        }

        function updateErrorsUI(errors) {
            const container = document.getElementById('errors-container');
            const stats = document.getElementById('stats');
            const filterBar = document.getElementById('filter-bar');

            if (errors.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-icon">✓</div>
                        <div>No errors found</div>
                    </div>
                \`;
                stats.textContent = 'No errors';
                filterBar.style.display = 'none';
                return;
            }

            // Показываем фильтры если есть ошибки
            filterBar.style.display = 'flex';

            // Подсчитываем статистику (по всем ошибкам)
            let errorCount = 0;
            let warningCount = 0;
            let infoCount = 0;
            for (const error of errors) {
                if (error.severity === 'error') errorCount++;
                else if (error.severity === 'warning') warningCount++;
                else infoCount++;
            }

            // Обновляем кнопки фильтров с количеством
            document.getElementById('filter-all').textContent = 'All (' + errors.length + ')';
            document.getElementById('filter-error').textContent = '❌ Errors (' + errorCount + ')';
            document.getElementById('filter-warning').textContent = '⚠️ Warnings (' + warningCount + ')';
            document.getElementById('filter-info').textContent = 'ℹ️ Info (' + infoCount + ')';

            stats.textContent = \`❌ \${errorCount}   ⚠️ \${warningCount}   ℹ️ \${infoCount}\`;

            // Применяем фильтр
            const filteredErrors = filterErrors(errors);

            if (filteredErrors.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <div>No \${currentFilter === 'info' ? 'info messages' : currentFilter + 's'} found</div>
                    </div>
                \`;
                return;
            }

            // Группируем отфильтрованные ошибки по файлам
            const errorsByFile = {};
            for (const error of filteredErrors) {
                if (!errorsByFile[error.fullPath]) {
                    errorsByFile[error.fullPath] = [];
                }
                errorsByFile[error.fullPath].push(error);
            }

            // Функция рендеринга одной ошибки
            function renderError(error) {
                const severityIcon = error.severity === 'error' ? '❌' : error.severity === 'warning' ? '⚠️' : 'ℹ️';
                const source = error.checkGroup || error.source || 'unknown';
                const showIgnore = source !== 'pre-commit';

                return \`
                    <div class="error-item \${error.severity}">
                        <div class="error-header-compact" onclick="gotoError('\${error.fullPath}', \${error.line})">
                            <span class="severity-icon">\${severityIcon}</span>
                            <span class="error-source">[\${source}]</span>
                            <span class="error-rule-name">\${error.rule}</span>
                            <span class="error-location-inline">Line \${error.line}\${error.column ? ':' + error.column : ''}</span>
                        </div>
                        <div class="error-messages" onclick="gotoError('\${error.fullPath}', \${error.line})">
                            <div class="error-lang-line"><span class="lang-label eng">EN:</span> \${escapeHtml(error.message)}</div>
                            \${error.detailedExplanation ? '<div class="error-lang-line"><span class="lang-label ru">RU:</span> ' + escapeHtml(error.detailedExplanation) + '</div>' : ''}
                        </div>
                        <div class="error-actions">
                            \${error.fixable ? '<span class="fixable-badge">🔧 Auto-fixable</span>' : ''}
                            \${showIgnore ? '<span class="ignore-btn" onclick="event.stopPropagation(); ignoreRule(\\'' + error.rule + '\\', \\'' + source + '\\')">🚫 Ignore</span>' : ''}
                        </div>
                    </div>
                \`;
            }

            // Рендерим ошибки - группируем по файлам
            let html = '';
            let fileIndex = 0;

            for (const [file, fileErrors] of Object.entries(errorsByFile)) {
                const fileName = fileErrors[0].file;
                const fileId = 'file-' + fileIndex;
                fileIndex++;

                html += \`
                    <div class="error-group">
                        <div class="file-header" onclick="toggleFile('\${fileId}')" id="header-\${fileId}" title="\${file}">
                            <div style="display: flex; align-items: center;">
                                <span class="collapse-icon">▼</span>
                                <span class="file-name">📁 \${fileName}</span>
                            </div>
                            <span class="error-count">\${fileErrors.length} issues</span>
                        </div>
                        <div class="file-errors" id="\${fileId}">
                \`;

                for (const error of fileErrors) {
                    html += renderError(error);
                }

                html += '</div></div>'; // Закрываем file-errors и error-group
            }

            container.innerHTML = html;
        }

        function toggleFile(fileId) {
            const errorsDiv = document.getElementById(fileId);
            const headerDiv = document.getElementById('header-' + fileId);

            if (errorsDiv && headerDiv) {
                errorsDiv.classList.toggle('collapsed');
                headerDiv.classList.toggle('collapsed');
            }
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

        function fixFile() {
            vscode.postMessage({
                type: 'fixFile'
            });
        }

        function refresh() {
            vscode.postMessage({
                type: 'refresh'
            });
        }

        function ignoreRule(rule, source) {
            vscode.postMessage({
                type: 'ignoreRule',
                rule: rule,
                source: source
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

        function openSettings() {
            vscode.postMessage({
                type: 'openSettings'
            });
        }

        function clearCache() {
            vscode.postMessage({
                type: 'clearCache'
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
