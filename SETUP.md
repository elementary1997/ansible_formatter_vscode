# Быстрая установка и настройка

## Windows

### Способ 1: Через pip

```powershell
# Установка Python (если не установлен)
# Скачайте с https://www.python.org/downloads/

# Обновление pip
python -m pip install --upgrade pip

# Установка инструментов
# ВАЖНО: ansible-lint требует установленный ansible!
pip install ansible yamllint ansible-lint pre-commit

# Проверка установки
python -m ansible --version
yamllint --version
ansible-lint --version
pre-commit --version
```

### Способ 2: Через pipx (рекомендуется)

```powershell
# Установка pipx
python -m pip install --user pipx
python -m pipx ensurepath

# Перезапустите PowerShell

# Установка инструментов
# ВАЖНО: ansible-lint требует ansible!
pipx install ansible --include-deps
pipx install yamllint
pipx install ansible-lint
pipx install pre-commit

# Проверка
ansible --version
yamllint --version
ansible-lint --version
pre-commit --version
```

## Linux / macOS

### Ubuntu/Debian

```bash
# Через apt (может быть устаревшая версия)
sudo apt install yamllint ansible-lint

# Или через pip (рекомендуется)
pip3 install --user yamllint ansible-lint pre-commit

# Добавьте в PATH (если нужно)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### macOS

```bash
# Через Homebrew
brew install yamllint ansible-lint pre-commit

# Или через pip
pip3 install --user yamllint ansible-lint pre-commit
```

## Настройка проекта

После установки инструментов в корне вашего проекта:

```bash
# Конфигурационные файлы уже созданы расширением:
# - .ansible-lint
# - .yamllint.yml

# Если используете pre-commit, создайте .pre-commit-config.yaml:
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
        args: ['--unsafe']
      - id: check-added-large-files

  - repo: https://github.com/ansible/ansible-lint
    rev: v6.22.0
    hooks:
      - id: ansible-lint
        files: \.(yaml|yml)$

  - repo: https://github.com/adrienverge/yamllint
    rev: v1.33.0
    hooks:
      - id: yamllint
EOF

# Установите hooks
pre-commit install
```

## Проверка работы

Создайте тестовый файл `test.yml`:

```yaml
---
- name: Test playbook
  hosts: localhost
  tasks:
    - name: Debug message
      debug:
        msg: "Hello World"
```

Запустите проверки вручную:

```bash
# yamllint
yamllint test.yml

# ansible-lint
ansible-lint test.yml

# pre-commit (все хуки)
pre-commit run --files test.yml
```

## Проверка в VS Code

1. Откройте проект в VS Code
2. Откройте файл YAML/Ansible
3. Нажмите на иконку **YAML Indent** в боковой панели
4. Если все установлено правильно, вы увидите результаты проверок

## Устранение проблем

### yamllint/ansible-lint не найдены

```bash
# Проверьте PATH
echo $PATH  # Linux/macOS
$env:PATH   # Windows PowerShell

# Найдите где установлены инструменты
which yamllint        # Linux/macOS
where.exe yamllint    # Windows

# Добавьте в PATH вручную (пример для Linux)
export PATH="$HOME/.local/bin:$PATH"
```

### Ошибки прав доступа (Windows)

Запустите PowerShell от имени администратора или используйте `--user` флаг:

```powershell
pip install --user yamllint ansible-lint pre-commit
```

### Pre-commit не запускается

```bash
# Переустановите хуки
pre-commit uninstall
pre-commit install

# Очистите кэш
pre-commit clean
```

## Дополнительная настройка

### Глобальная конфигурация yamllint

Создайте `~/.config/yamllint/config`:

```yaml
extends: default
rules:
  line-length:
    max: 260
```

### Интеграция с Git

```bash
# Автоматическая проверка перед коммитом
pre-commit install

# Проверка всех файлов
pre-commit run --all-files
```
