import * as vscode from 'vscode';
import { IndentFixer } from './indentFixer';

export class IndentPreviewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'yamlIndentVisualizer.preview';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview,
            '<p>Загрузка...</p>');

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'applyFix':
                    {
                        const editor = vscode.window.activeTextEditor;
                        if (editor && data.range) {
                            const range = new vscode.Range(
                                data.range[0], data.range[1],
                                data.range[2], data.range[3]
                            );
                            this.applyFix(data.text, range);
                        }
                    }
                    break;
                case 'refresh':
                    if (vscode.window.activeTextEditor) {
                        this.update(vscode.window.activeTextEditor);
                    }
                    break;
            }
        });

        // DO NOT auto-run - only manual refresh via button
        // User explicitly requested: check ONLY when refresh button is clicked
    }

    private updateTimeout: NodeJS.Timeout | undefined;

    public async update(editor: vscode.TextEditor) {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(async () => {
            await this._doUpdate(editor);
        }, 800); // 800ms debounce
    }

    private async _doUpdate(editor: vscode.TextEditor) {
        if (this._view) {
            // Get the ENTIRE document text
            const text = editor.document.getText();

            if (!text.trim()) {
                this._view.webview.html = this._getHtmlForWebview(this._view.webview, '<p>Документ пуст.</p>');
                return;
            }

            // Show loading
            this._view.webview.html = this._getHtmlForWebview(this._view.webview, '<p>⏳ Проверка файла (запуск линтеров и форматирование)...</p>');

            try {
                // Run linters first on ORIGINAL
                const linterResultsOriginal = await IndentFixer.runLinters(editor);
                
                // Then check formatting
                const fixed = await IndentFixer.fixTextAsync(text, editor);

                // Build results HTML
                let resultsHtml = '<div class="results-section">';
                
                // Show linter results
                resultsHtml += '<h3>🔍 Best Practices & Lint</h3>';
                
                // Show linter results (only ansible-lint now)
                if (linterResultsOriginal.length > 0) {
                    resultsHtml += '<div class="lint-results">';
                    for (const result of linterResultsOriginal) {
                        const isSuccess = result.includes('✅') || result.includes('Ошибок не найдено');
                        const isWarning = result.includes('⚠️') || result.includes('Не установлен');
                        const resultClass = isSuccess ? 'lint-success' : (isWarning ? 'lint-info' : 'lint-error');
                        resultsHtml += `<div class="${resultClass}"><pre>${escapeHtml(result)}</pre></div>`;
                    }
                    resultsHtml += '</div>';
                } else {
                    resultsHtml += '<p style="color: gray;">Линтеры не запущены или не настроены</p>';
                }

                // Show formatting results
                resultsHtml += '<h3>📝 Автоисправление</h3>';
                
                console.log(`[PreviewProvider] Original text length: ${text.length}`);
                console.log(`[PreviewProvider] Fixed text length: ${fixed.length}`);
                console.log(`[PreviewProvider] Texts are ${fixed === text ? 'SAME' : 'DIFFERENT'}`);
                
                if (fixed === text) {
                    resultsHtml += `<p style="color: orange;">⚠️ Автоматическое исправление не сработало.</p>
                                   <p style="color: gray;">Возможно, ошибки нужно исправлять вручную.</p>
                                   <p style="color: gray;">Используйте инструменты вручную:</p>
                                   <pre style="font-size: 10px;">
# В терминале:
cd test_extension
pre-commit run --files main.yml
ansible-lint --fix main.yml
yamllint --strict main.yml</pre>`;
                } else {
                    // Calculate range for entire document
                    const lastLine = editor.document.lineCount - 1;
                    const lastLineLength = editor.document.lineAt(lastLine).text.length;
                    
                    // Escape the fixed text properly for JSON
                    const fixedTextJson = JSON.stringify(fixed);
                    
                    const bytesChanged = Math.abs(fixed.length - text.length);
                    resultsHtml += `<p style="color: green;">✅ Автоисправление выполнено! (изменено ${bytesChanged} байт)</p>
                         <p style="color: gray;">Примечание: Могут остаться ошибки, которые нужно исправлять вручную</p>
                         <div class="fixed-container">
                            <pre>${escapeHtml(fixed)}</pre>
                         </div>
                         <button class="fix-btn" id="applyFixBtn" data-fixed="${escapeHtml(fixedTextJson)}" data-range="${lastLine},${lastLineLength}">✅ Применить исправления</button>`;
                }
                
                resultsHtml += '</div>';
                
                this._view.webview.html = this._getHtmlForWebview(this._view.webview, resultsHtml, fixed);
            } catch (err) {
                this._view.webview.html = this._getHtmlForWebview(this._view.webview, `<p style="color: red;">Ошибка: ${err}</p>`);
            }
        }
    }

    private applyFix(fixedText: string, rangeOrSelection?: vscode.Range | vscode.Selection) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                if (rangeOrSelection) {
                    editBuilder.replace(rangeOrSelection, fixedText);
                } else {
                    const fullRange = new vscode.Range(
                        editor.document.positionAt(0),
                        editor.document.positionAt(editor.document.getText().length)
                    );
                    editBuilder.replace(fullRange, fixedText);
                }
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview, content: string, fixedText?: string) {
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Indent Preview</title>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    window.addEventListener('DOMContentLoaded', () => {
                        // Handle apply fix button
                        const applyBtn = document.getElementById('applyFixBtn');
                        if (applyBtn) {
                            applyBtn.addEventListener('click', () => {
                                const fixedJson = applyBtn.getAttribute('data-fixed');
                                const rangeStr = applyBtn.getAttribute('data-range');
                                
                                if (fixedJson && rangeStr) {
                                    try {
                                        const fixedText = JSON.parse(fixedJson);
                                        const [lastLine, lastLineLength] = rangeStr.split(',').map(Number);
                                        
                                        vscode.postMessage({
                                            type: 'applyFix',
                                            text: fixedText,
                                            range: [0, 0, lastLine, lastLineLength]
                                        });
                                    } catch (e) {
                                        console.error('Error applying fix:', e);
                                    }
                                }
                            });
                        }
                        
                        // Handle refresh button
                        const refreshBtn = document.querySelector('.refresh-btn');
                        if (refreshBtn) {
                            refreshBtn.addEventListener('click', () => {
                                vscode.postMessage({ type: 'refresh' });
                            });
                        }
                    });
                </script>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 10px; 
                        color: var(--vscode-editor-foreground);
                        overflow-y: auto;
                        max-height: 100vh;
                    }
                    pre { 
                        background: var(--vscode-editor-background); 
                        border: 1px solid var(--vscode-widget-border); 
                        padding: 8px; 
                        overflow-x: auto;
                        overflow-y: auto;
                        font-size: 11px;
                        max-height: 400px;
                        white-space: pre;
                        word-wrap: normal;
                        font-family: var(--vscode-editor-font-family);
                        line-height: 1.4;
                    }
                    h3 { 
                        color: var(--vscode-foreground); 
                        margin-top: 15px; 
                        margin-bottom: 10px;
                        font-size: 14px;
                    }
                    .fix-btn, .refresh-btn { 
                        background: var(--vscode-button-background); 
                        color: var(--vscode-button-foreground); 
                        border: none; padding: 8px 12px; cursor: pointer; width: 100%; margin-top: 10px;
                    }
                    .fix-btn:hover, .refresh-btn:hover { background: var(--vscode-button-hoverBackground); }
                    .refresh-btn {
                        background: transparent;
                        color: var(--vscode-foreground);
                        margin-bottom: 15px;
                        font-size: 18px;
                        padding: 6px;
                        width: auto;
                        min-width: 40px;
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 3px;
                    }
                    .refresh-btn:hover {
                        background: var(--vscode-toolbar-hoverBackground);
                    }
                    .fixed-container {
                        margin-top: 10px;
                        margin-bottom: 10px;
                        overflow-y: auto;
                        max-height: 70vh;
                    }
                    .fixed-container pre { 
                        border-left: 3px solid green; 
                        background: rgba(0, 255, 0, 0.05);
                        max-height: none;
                    }
                    .results-section { 
                        margin-top: 10px;
                        overflow-y: auto;
                    }
                    .lint-results { 
                        display: flex; 
                        flex-direction: column; 
                        gap: 8px; 
                        margin-bottom: 15px;
                        overflow-y: auto;
                    }
                    .lint-success { 
                        background: rgba(0, 255, 0, 0.1); 
                        border-left: 3px solid green; 
                        padding: 8px;
                        overflow: auto;
                    }
                    .lint-error { 
                        background: rgba(255, 0, 0, 0.1); 
                        border-left: 3px solid red; 
                        padding: 8px;
                        overflow: auto;
                    }
                    .lint-info { 
                        background: rgba(255, 165, 0, 0.1); 
                        border-left: 3px solid orange; 
                        padding: 8px;
                        overflow: auto;
                    }
                    .lint-success pre, .lint-error pre, .lint-info pre {
                        margin: 0;
                        background: transparent;
                        border: none;
                        padding: 0;
                        max-height: none;
                    }
                </style>
			</head>
			<body>
                <button class="refresh-btn" title="Обновить / Проверить отступы">🔄</button>
				${content}
			</body>
			</html>`;
    }
}

function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
