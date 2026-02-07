# Полезные Сниппеты (Code Snippets)

Скопируйте эти сниппеты в ваш файл `package.json` или глобальные настройки сниппетов, чтобы ускорить разработку.

## 1. Регистрация команды (TypeScript)
```typescript
// Вставьте в activate функцию
let disposable = vscode.commands.registerCommand('${1:commandId}', async () => {
    ${2:vscode.window.showInformationMessage('Hello World!');}
});
context.subscriptions.push(disposable);
```

## 2. Создание Output Channel
```typescript
const outputChannel = vscode.window.createOutputChannel('${1:Extension Name}');
outputChannel.appendLine('${2:Log message}');
outputChannel.show();
```

## 3. Webview Panel
```typescript
const panel = vscode.window.createWebviewPanel(
    '${1:viewType}', // Identifies the type of the webview. Used internally
    '${2:Title}', // Title of the panel displayed to the user
    vscode.ViewColumn.One, // Editor column to show the new webview panel in.
    {
        enableScripts: true
    } // Webview options
);
panel.webview.html = getWebviewContent();
```
