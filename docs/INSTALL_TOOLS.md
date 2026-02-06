# Установка инструментов для расширения

## 🚨 ВАЖНО: ansible-lint требует ansible!

Если вы видите ошибку:
```
CRITICAL:root:No module named 'ansible'
```

Это значит что нужно установить `ansible` перед `ansible-lint`.

## Windows - Быстрая установка

```powershell
# Один раз установить ВСЁ (рекомендуется)
pip install ansible yamllint ansible-lint pre-commit

# Проверка
python -m ansible --version
yamllint --version
ansible-lint --version
pre-commit --version
```

## Linux / macOS - Быстрая установка

```bash
# Установка всех инструментов
pip3 install --user ansible yamllint ansible-lint pre-commit

# Проверка
ansible --version
yamllint --version
ansible-lint --version
pre-commit --version
```

## Установка по отдельности

### 1. Ansible (ОБЯЗАТЕЛЬНО для ansible-lint)

```bash
# Windows
pip install ansible

# Linux/macOS
pip3 install --user ansible

# Проверка
ansible --version
```

### 2. yamllint

```bash
pip install yamllint

# Проверка
yamllint --version
```

### 3. ansible-lint (требует ansible!)

```bash
pip install ansible-lint

# Проверка
ansible-lint --version
```

### 4. pre-commit (опционально)

```bash
pip install pre-commit

# Проверка
pre-commit --version
```

## Проверка работы

После установки откройте VS Code:

1. Откройте YAML файл
2. Откройте панель **YAML Indent**
3. Должны увидеть:

```
🔍 Best Practices & Lint

📋 yamllint:
   ✅ Ошибок не найдено

🔍 ansible-lint:
   ✅ Ошибок не найдено

📝 Форматирование
   ✔ Отступы в порядке!
```

## Устранение проблем

### Ошибка: "No module named 'ansible'"

```bash
# Установите ansible
pip install ansible

# Проверьте
python -m ansible --version
```

### Ошибка: "command not found" (Windows)

```powershell
# Убедитесь что Python Scripts в PATH
# Добавьте в PATH:
C:\Users\YOUR_USERNAME\AppData\Local\Programs\Python\Python3X\Scripts
C:\Users\YOUR_USERNAME\AppData\Roaming\Python\Python3X\Scripts

# Или установите с --user
pip install --user ansible yamllint ansible-lint
```

### Ошибка: "command not found" (Linux/macOS)

```bash
# Добавьте в ~/.bashrc или ~/.zshrc
export PATH="$HOME/.local/bin:$PATH"

# Перезагрузите shell
source ~/.bashrc  # или source ~/.zshrc
```

### Проверка где установлены инструменты

```bash
# Windows
where.exe yamllint
where.exe ansible-lint

# Linux/macOS
which yamllint
which ansible-lint
```

## Альтернатива: pipx (изолированные окружения)

```bash
# Установка pipx
pip install --user pipx
pipx ensurepath

# Установка инструментов
pipx install ansible --include-deps
pipx install yamllint
pipx install ansible-lint
pipx install pre-commit
```

## Версии (рекомендуемые)

- Python: 3.8+
- ansible: 2.10+
- yamllint: 1.26+
- ansible-lint: 6.0+
- pre-commit: 3.0+

## Проверка версий

```bash
python --version
pip list | grep -E "ansible|yamllint|pre-commit"
```
