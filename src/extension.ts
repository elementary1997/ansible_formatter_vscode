import * as vscode from 'vscode';
import * as cp from 'child_process';
import { IndentPreviewProvider } from './previewProvider';

let parentKeyDecorationType: vscode.TextEditorDecorationType;
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('YAML Indent Visualizer is now active!');

    // Проверяем и устанавливаем зависимости
    checkAndInstallDependencies(context);

    // Initialize decoration type
    updateDecorationType();

    // Initialize diagnostics
    diagnosticCollection = vscode.languages.createDiagnosticCollection('yaml-indent');
    context.subscriptions.push(diagnosticCollection);

    // Initialize Preview Provider
    const previewProvider = new IndentPreviewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(IndentPreviewProvider.viewType, previewProvider)
    );

    // Update decoration type if configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration('yamlIndentVisualizer')) {
            updateDecorationType();
        }
    }));

    // Listener for selection changes
    let selectionDisposable = vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
        const editor = event.textEditor;
        if (!editor || (editor.document.languageId !== 'yaml' && editor.document.languageId !== 'ansible')) {
            return;
        }
        updateDecorations(editor);
        // previewProvider.update(editor); // Disabled - should not run on selection
    });

    // Listener for document changes (for linting)
    let changeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'yaml' || event.document.languageId === 'ansible') {
            refreshDiagnostics(event.document, diagnosticCollection);
        }
    });

    // Listener for active editor change (to validate immediately)
    let activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && (editor.document.languageId === 'yaml' || editor.document.languageId === 'ansible')) {
            refreshDiagnostics(editor.document, diagnosticCollection);
            updateDecorations(editor);
            previewProvider.update(editor);
        }
    });

    context.subscriptions.push(selectionDisposable, changeDisposable, activeEditorDisposable);
}

function updateDecorationType() {
    if (parentKeyDecorationType) {
        parentKeyDecorationType.dispose();
    }

    const config = vscode.workspace.getConfiguration('yamlIndentVisualizer');
    const color = config.get<string>('highlightColor') || 'rgba(255, 215, 0, 0.3)';
    // const showRuler = config.get<boolean>('showRuler'); // TODO: Implement ruler logic if needed

    parentKeyDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        isWholeLine: false, // Only highlight the text, not the whole line width
        borderRadius: '2px'
    });
}

function updateDecorations(editor: vscode.TextEditor) {
    if (!editor.selection.isEmpty) {
        // Option 1: If selection is not empty, maybe clear or process differently?
        // For now, let's focus on cursor position (active)
    }

    const document = editor.document;
    const currentLineIndex = editor.selection.active.line;
    const currentLineText = document.lineAt(currentLineIndex).text;

    // Calculate indentation of current line
    // Use regex to find leading spaces
    const currentIndentMatch = currentLineText.match(/^(\s*)/);
    let currentIndent = currentIndentMatch ? currentIndentMatch[1].length : 0;

    // If the line is empty, try to infer context from above (optional, but good for UX)
    if (currentLineText.trim() === '') {
        // Just take the indentation of the cursor if possible, or skip
        // For simplicity, let's treat empty line as having 0 indent effectively for searching parents? 
        // No, if I am on an empty line inside a block, I want to see parents.
        // Let's assume the cursor character index is the desired indent.
        currentIndent = editor.selection.active.character;
    }

    const parentRanges: vscode.Range[] = [];

    // Traverse upwards
    let nextIndentLimit = currentIndent;

    for (let i = currentLineIndex - 1; i >= 0; i--) {
        const line = document.lineAt(i);
        const text = line.text;

        // Skip empty lines
        if (text.trim() === '') {
            continue;
        }

        const indentMatch = text.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;

        // Found a parent
        if (indent < nextIndentLimit) {
            // Add to decoration ranges
            // Try to match key more robustly (handle quotes)
            const keyMatch = text.match(/^\s*(?:-\s+)?(?:["']?)([\w\-\s]+)(?:["']?)\s*:/);

            if (keyMatch) {
                // Highlight the captured key part
                // We need to find the specific start index of the capture group in the original string
                const matchString = keyMatch[1];
                const keyStart = text.indexOf(matchString, indent); // search after indentation
                if (keyStart !== -1) {
                    const keyEnd = keyStart + matchString.length;
                    parentRanges.push(new vscode.Range(i, keyStart, i, keyEnd));
                } else {
                    // Fallback
                    parentRanges.push(line.range);
                }
            } else {
                // Determine range of non-whitespace content
                const firstChar = line.firstNonWhitespaceCharacterIndex;
                const lastChar = text.trimRight().length;
                parentRanges.push(new vscode.Range(i, firstChar, i, lastChar));
            }

            // Set new limit
            nextIndentLimit = indent;

            // Stop if we reached root
            if (indent === 0) {
                break;
            }
        }
    }

    editor.setDecorations(parentKeyDecorationType, parentRanges);
}

function refreshDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const diagnostics: vscode.Diagnostic[] = [];

    // Simple heuristic validation
    // 1. Indentation should be multiple of 2 spaces (standard Ansible/YAML practice)

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        if (text.trim() === '') {
            continue;
        }

        const indentMatch = text.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;

        // Check 1: Even indentation
        if (indent % 2 !== 0) {
            const range = new vscode.Range(i, 0, i, indent);
            const diagnostic = new vscode.Diagnostic(range, 'Indentation should be a multiple of 2 spaces', vscode.DiagnosticSeverity.Warning);
            diagnostics.push(diagnostic);
        }

        // Check 2: Tab usage (YAML forbids tabs)
        if (text.includes('\t')) {
            const tabIndex = text.indexOf('\t');
            const range = new vscode.Range(i, tabIndex, i, tabIndex + 1);
            const diagnostic = new vscode.Diagnostic(range, 'YAML forbids tabs. Use spaces.', vscode.DiagnosticSeverity.Error);
            diagnostics.push(diagnostic);
        }
    }

    collection.set(document.uri, diagnostics);
}

async function checkAndInstallDependencies(context: vscode.ExtensionContext) {
    const DEPS_CHECKED_KEY = 'yamlIndentVisualizer.depsChecked';
    
    // Проверяем только один раз за сессию
    const alreadyChecked = context.globalState.get<boolean>(DEPS_CHECKED_KEY, false);
    if (alreadyChecked) {
        return;
    }

    const tools = [
        { name: 'yamllint', cmd: 'yamllint --version' },
        { name: 'ansible-lint', cmd: 'ansible-lint --version' },
        { name: 'ansible', cmd: 'ansible --version' }
    ];

    const missing: string[] = [];

    for (const tool of tools) {
        const exists = await checkToolExists(tool.cmd);
        if (!exists) {
            missing.push(tool.name);
        }
    }

    if (missing.length > 0) {
        const message = `YAML Indent Visualizer: Не найдены инструменты: ${missing.join(', ')}. Установить автоматически?`;
        const install = 'Установить';
        const later = 'Позже';
        const never = 'Не спрашивать';

        const choice = await vscode.window.showInformationMessage(message, install, later, never);

        if (choice === install) {
            await installDependencies(missing);
        } else if (choice === never) {
            await context.globalState.update(DEPS_CHECKED_KEY, true);
        }
    } else {
        await context.globalState.update(DEPS_CHECKED_KEY, true);
    }
}

async function checkToolExists(command: string): Promise<boolean> {
    return new Promise((resolve) => {
        cp.exec(command, (error) => {
            resolve(!error || error.code === 0);
        });
    });
}

async function installDependencies(tools: string[]): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('YAML Indent Visualizer - Установка');
    outputChannel.show();

    outputChannel.appendLine('Начинаем установку зависимостей...');
    outputChannel.appendLine('');

    // Определяем команду установки
    const isLinux = process.platform === 'linux';
    const isMac = process.platform === 'darwin';
    const isWindows = process.platform === 'win32';

    let installCmd = '';
    
    if (isWindows) {
        installCmd = 'pip install';
    } else {
        installCmd = 'pip3 install --user';
    }

    // Для ansible-lint нужен ansible
    const packagesToInstall = new Set(tools);
    if (packagesToInstall.has('ansible-lint')) {
        packagesToInstall.add('ansible');
    }

    const packages = Array.from(packagesToInstall).join(' ');
    const fullCommand = `${installCmd} ${packages}`;

    outputChannel.appendLine(`Выполняется: ${fullCommand}`);
    outputChannel.appendLine('');

    return new Promise((resolve) => {
        const proc = cp.exec(fullCommand, (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine('❌ Ошибка установки:');
                outputChannel.appendLine(error.message);
                outputChannel.appendLine(stderr);
                
                vscode.window.showErrorMessage(
                    'Не удалось установить зависимости автоматически. Установите вручную: ' + 
                    fullCommand
                );
            } else {
                outputChannel.appendLine('✅ Установка завершена успешно!');
                outputChannel.appendLine('');
                outputChannel.appendLine('Установленные пакеты:');
                outputChannel.appendLine(stdout);
                
                // Проверяем PATH
                if (!isWindows) {
                    const homeDir = process.env.HOME || '~';
                    const localBin = `${homeDir}/.local/bin`;
                    
                    outputChannel.appendLine('');
                    outputChannel.appendLine('⚠️ ВАЖНО: Убедитесь что ~/.local/bin в PATH:');
                    outputChannel.appendLine(`echo 'export PATH="${localBin}:$PATH"' >> ~/.bashrc`);
                    outputChannel.appendLine('source ~/.bashrc');
                    outputChannel.appendLine('');
                    outputChannel.appendLine('Затем перезапустите VS Code.');
                }

                vscode.window.showInformationMessage(
                    'Зависимости установлены! Перезапустите VS Code для применения изменений.',
                    'Перезапустить'
                ).then(choice => {
                    if (choice === 'Перезапустить') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
            }
            resolve();
        });

        // Выводим процесс установки в реальном времени
        if (proc.stdout) {
            proc.stdout.on('data', (data) => {
                outputChannel.append(data.toString());
            });
        }
        if (proc.stderr) {
            proc.stderr.on('data', (data) => {
                outputChannel.append(data.toString());
            });
        }
    });
}

export function deactivate() {
    if (parentKeyDecorationType) {
        parentKeyDecorationType.dispose();
    }
}
