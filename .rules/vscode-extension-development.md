# Правила разработки расширений VSCode

Этот документ содержит рекомендации и правила для разработки качественных расширений для Visual Studio Code.

## 1. Структура проекта
Соблюдайте чистую структуру проекта:
```text
.
├── src/
│   ├── commands/       # Реализация команд
│   ├── providers/      # Провайдеры данных (TreeViews, Webviews)
│   ├── test/           # Тесты
│   └── extension.ts    # Точка входа
├── resources/          # Иконки и медиа
├── package.json        # Манифест расширения
└── tsconfig.json       # Настройки TypeScript
```

## 2. package.json: Лучшие практики
- **activationEvents**: Используйте `onStartupFinished` вместо `*` для улучшения производительности, если возможно. Лучше всего активировать только при необходимости (например, `onCommand:myExtension.helloWorld`).
- **contributes**: Четко группируйте вклады (commands, menus, views).
- **publisher**: Укажите имя издателя (publisher name).

## 3. Соглашения об именовании
- **Команды**: Используйте формат `myExtension.actionName` (например, `todoList.addEntry`).
- **Конфигурация**: Настройки должны иметь префикс вашего расширения (например, `todoList.autoSave`).
- **Классы**: PascalCase (например, `TodoProvider`).
- **Переменные/Функции**: camelCase (например, `refreshList`).

## 4. Стандарты кода
- **Async/Await**: Всегда используйте `async/await` для асинхронных операций вместо колбэков.
- **Disposables**: Все ресурсы (команды, провайдеры) должны быть добавлены в `context.subscriptions` для корректной очистки.
```typescript
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('myExtension.sayHello', () => {
        vscode.window.showInformationMessage('Hello World!');
    });
    context.subscriptions.push(disposable);
}
```
- **Либтерирование**: Используйте ESLint и Prettier.

## 5. Работа с UI/UX
- **Уведомления**:
  - `showInformationMessage`: Для подтверждения действий.
  - `showErrorMessage`: Для критических ошибок.
  - `showWarningMessage`: Для важных предупреждений.
  - Не спамьте уведомлениями. Используйте `OutputChannel` для логов.
- **Progress API**: Используйте `vscode.window.withProgress` для длительных операций, чтобы не блокировать интерфейс.

## 6. Вебвью (Webviews)
- Используйте Webviews только когда стандартного UI недостаточно.
- Всегда используйте `Content-Security-Policy`.
- Передавайте сообщения через `postMessage` для общения между расширением и Webview.

## 7. Тестирование
- Используйте `vscode-test` для интеграционных тестов.
- Пишите юнит-тесты для логики, не зависящей от VSCode API.

## 8. Публикация
- Используйте `vsce` для упаковки: `vsce package`.
- Не включайте `node_modules` в репозиторий (добавьте в `.gitignore`).
- Используйте `.vscodeignore` для исключения лишних файлов из пакета расширения (исходники тестов, конфиги линтеров).
