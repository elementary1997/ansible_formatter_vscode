# Запуск расширения на Linux

## 📋 Требования

- **Node.js** 14.x или выше
- **npm** 6.x или выше
- **VS Code** 1.60.0 или выше
- **Python 3.8+** (для линтеров)
- **Git**

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
# Клонируем проект
git clone https://github.com/elementary1997/ansible_formatter_vscode.git
cd ansible_formatter_vscode
```

### 2. Установка Node.js зависимостей

```bash
# Устанавливаем зависимости проекта
npm install

# Компилируем TypeScript
npm run compile
```

### 3. Установка линтеров (обязательно для полной функциональности)

#### Ubuntu/Debian:

```bash
# Обновляем систему
sudo apt update

# Устанавливаем Python и pip (если нет)
sudo apt install python3 python3-pip

# Устанавливаем линтеры
pip3 install --user ansible yamllint ansible-lint pre-commit

# Добавляем ~/.local/bin в PATH (если еще не добавлен)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### Fedora/RHEL/CentOS:

```bash
# Устанавливаем Python и pip
sudo dnf install python3 python3-pip

# Устанавливаем линтеры
pip3 install --user ansible yamllint ansible-lint pre-commit

# Добавляем в PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### Arch Linux:

```bash
# Устанавливаем из официальных репозиториев
sudo pacman -S python-pip ansible

# Устанавливаем линтеры
pip install --user yamllint ansible-lint pre-commit

# Добавляем в PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### Проверка установки:

```bash
# Проверяем что все установлено
ansible --version
yamllint --version
ansible-lint --version
pre-commit --version
```

### 4. Запуск расширения в VS Code

#### Метод 1: Запуск в режиме разработки (F5)

```bash
# Открываем проект в VS Code
code .

# В VS Code:
# 1. Нажмите F5 или выберите "Run > Start Debugging"
# 2. Откроется новое окно "Extension Development Host"
# 3. В новом окне откройте любой YAML/Ansible файл
# 4. Откройте панель "YAML Indent" слева
```

#### Метод 2: Установка как VSIX пакет

```bash
# Создаем VSIX пакет
npm install -g @vscode/vsce
vsce package

# Устанавливаем в VS Code
code --install-extension yaml-indent-visualizer-0.1.0.vsix
```

## 🧪 Тестирование

### 1. Тестовый файл

```bash
# Откройте тестовый файл с ошибками
code test_extension/main.yml
```

### 2. Проверка функций

1. **Откройте панель расширения:**
   - Нажмите на иконку "YAML Indent" в боковой панели
   - Или используйте View → Open View → YAML Indent: Indent Preview

2. **Проверьте что работает:**
   - ✅ Автоматический запуск проверки при открытии панели
   - ✅ Подсветка родительских ключей при навигации
   - ✅ Вывод результатов yamllint
   - ✅ Вывод результатов ansible-lint
   - ✅ Предложения по исправлению отступов
   - ✅ Кнопка "Применить исправления"

### 3. Проверка линтеров из терминала

```bash
# Проверяем yamllint
yamllint test_extension/main.yml

# Проверяем ansible-lint
ansible-lint test_extension/main.yml
```

## 🐛 Отладка

### Просмотр логов расширения

1. Откройте **Developer Tools**: `Help → Toggle Developer Tools`
2. Перейдите на вкладку **Console**
3. Ищите сообщения с префиксом `[IndentFixer]`

### Проверка что линтеры доступны

```bash
# Проверяем PATH
echo $PATH | grep -o "$HOME/.local/bin"

# Проверяем где установлены линтеры
which yamllint
which ansible-lint

# Проверяем версии Python модулей
pip3 list | grep -E "ansible|yamllint"
```

### Типичные проблемы

#### Проблема: "command not found: yamllint"

```bash
# Решение 1: Добавьте в PATH
export PATH="$HOME/.local/bin:$PATH"

# Решение 2: Установите глобально
sudo pip3 install yamllint ansible-lint
```

#### Проблема: "No module named 'ansible'"

```bash
# Установите ansible перед ansible-lint
pip3 install --user ansible ansible-lint
```

#### Проблема: "Extension host terminated unexpectedly"

```bash
# Пересоберите расширение
npm run compile

# Очистите кэш
rm -rf out/
npm run compile
```

## 🔄 Режим разработки (watch mode)

Для автоматической компиляции при изменениях:

```bash
# Терминал 1: Watch компиляция
npm run watch

# Терминал 2: Запуск VS Code
code .
# Затем нажмите F5
```

## 📦 Создание пакета для распространения

```bash
# Установка vsce (если еще нет)
npm install -g @vscode/vsce

# Создание VSIX пакета
vsce package

# Результат: yaml-indent-visualizer-0.1.0.vsix
```

## 🌐 Установка на другую машину

```bash
# На целевой Linux машине:

# 1. Скопируйте VSIX файл
scp yaml-indent-visualizer-0.1.0.vsix user@target-machine:~/

# 2. На целевой машине установите
code --install-extension ~/yaml-indent-visualizer-0.1.0.vsix

# 3. Установите линтеры
pip3 install --user ansible yamllint ansible-lint
```

## 🐳 Docker (опционально)

Если хотите тестировать в изолированной среде:

```dockerfile
# Создайте Dockerfile:
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install ansible yamllint ansible-lint

WORKDIR /workspace
COPY . .
RUN npm install && npm run compile

CMD ["/bin/bash"]
```

```bash
# Сборка и запуск:
docker build -t ansible-formatter-test .
docker run -it -v $(pwd):/workspace ansible-formatter-test
```

## ✅ Checklist готовности

- [ ] Node.js и npm установлены
- [ ] Git установлен
- [ ] VS Code установлен
- [ ] Репозиторий склонирован
- [ ] `npm install` выполнен успешно
- [ ] `npm run compile` завершился без ошибок
- [ ] Python 3 установлен
- [ ] ansible установлен
- [ ] yamllint установлен
- [ ] ansible-lint установлен
- [ ] Линтеры доступны в PATH
- [ ] Расширение запускается по F5
- [ ] Тестовые файлы открываются
- [ ] Панель показывает результаты проверок

## 📞 Поддержка

Если возникли проблемы:

1. Проверьте логи в Developer Tools (Console)
2. Убедитесь что все зависимости установлены
3. Проверьте версии: `node --version`, `npm --version`, `python3 --version`
4. Создайте issue на GitHub с логами ошибок

## 🔗 Полезные ссылки

- [Документация VS Code Extension API](https://code.visualstudio.com/api)
- [yamllint документация](https://yamllint.readthedocs.io/)
- [ansible-lint документация](https://ansible-lint.readthedocs.io/)
- [Node.js загрузка](https://nodejs.org/)
