# Pre-commit Setup для Ansible Lint Helper

## Установка pre-commit версии 5.0.0

### Для Linux/Mac:

```bash
# Установка через pip
pip install pre-commit==5.0.0

# Или через pipx (рекомендуется)
pipx install pre-commit==5.0.0
```

### Для Windows:

```powershell
# Установка через pip
pip install pre-commit==5.0.0
```

## Проверка установки

```bash
pre-commit --version
# Должно показать: pre-commit 5.0.0
```

## Настройка в проекте

1. **Скопируйте .pre-commit-config.yaml в ваш Ansible проект**
   ```bash
   cp .pre-commit-config.yaml /path/to/your/ansible/project/
   ```

2. **Перейдите в директорию проекта**
   ```bash
   cd /path/to/your/ansible/project
   ```

3. **Установите pre-commit хуки**
   ```bash
   pre-commit install
   ```

4. **Запустите на всех файлах (опционально)**
   ```bash
   pre-commit run --all-files
   ```

## Использование в VSCode расширении

После установки pre-commit, расширение автоматически найдет его и добавит команду:

- **Command Palette** (`Ctrl+Shift+P`) → `Ansible Lint: Run pre-commit`

## Конфигурация .pre-commit-config.yaml

Файл `.pre-commit-config.yaml` содержит:

### 1. Базовые хуки:
- `trailing-whitespace` - удаление лишних пробелов
- `end-of-file-fixer` - исправление конца файла
- `check-yaml` - проверка YAML синтаксиса
- `check-added-large-files` - проверка больших файлов
- `mixed-line-ending` - проверка окончаний строк

### 2. Ansible-lint хук:
- Автоматическая проверка Ansible файлов
- Использует последнюю версию ansible-lint
- Цветной вывод (`--force-color`)

## Автоматический запуск

Pre-commit будет автоматически запускаться:
- При каждом `git commit`
- Можно запустить вручную: `pre-commit run`
- Можно запустить через VSCode расширение

## Пропуск pre-commit (если нужно)

Иногда нужно сделать commit без проверки:

```bash
git commit -m "message" --no-verify
```

⚠️ **Не рекомендуется использовать часто!**

## Обновление pre-commit хуков

```bash
pre-commit autoupdate
```

Это обновит версии всех хуков в `.pre-commit-config.yaml`.

## Удаление pre-commit хуков

Если нужно удалить:

```bash
pre-commit uninstall
```

## Troubleshooting

### pre-commit не найден

**Проблема:** `pre-commit: command not found`

**Решение:**
```bash
# Убедитесь что ~/.local/bin в PATH
echo $PATH | grep .local/bin

# Если нет, добавьте в ~/.bashrc или ~/.zshrc:
export PATH="$HOME/.local/bin:$PATH"

# Перезагрузите shell
source ~/.bashrc
```

### Ошибка ansible-lint в pre-commit

**Проблема:** ansible-lint не работает в pre-commit

**Решение:**
```bash
# Убедитесь что ansible и ansible-lint установлены
pip install ansible ansible-lint

# Пересоздайте окружение pre-commit
pre-commit clean
pre-commit install --install-hooks
```

### Медленная работа pre-commit

**Решение:**
```bash
# Запускайте только на измененных файлах
git add <files>
git commit

# Вместо --all-files
```

## Интеграция с VSCode расширением

Расширение Ansible Lint Helper поддерживает pre-commit:

1. ✅ Автоматическое определение pre-commit
2. ✅ Запуск через Command Palette
3. ✅ Парсинг вывода pre-commit
4. ✅ Отображение ошибок в UI
5. ✅ Поддержка версии 5.0.0

## Дополнительные хуки для Ansible

Можно добавить в `.pre-commit-config.yaml`:

```yaml
  # Проверка синтаксиса Ansible
  - repo: https://github.com/ansible-community/ansible-lint
    rev: v24.2.0
    hooks:
      - id: ansible-lint
        args: ['--profile', 'production']

  # Yamllint
  - repo: https://github.com/adrienverge/yamllint
    rev: v1.35.1
    hooks:
      - id: yamllint
```

## Полезные команды

```bash
# Показать все хуки
pre-commit run --help

# Запустить конкретный хук
pre-commit run ansible-lint

# Запустить на конкретном файле
pre-commit run --files main.yml

# Показать версию
pre-commit --version

# Очистить кеш
pre-commit clean

# Показать конфигурацию
pre-commit sample-config
```
