# Pre-commit (обязательная зависимость)

## 📌 Важно знать

**Pre-commit ОБЯЗАТЕЛЕН** для полноценной работы расширения!

Он используется только если:
1. В проекте есть файл `.pre-commit-config.yaml`
2. И pre-commit установлен в системе

Если его нет - расширение использует встроенный алгоритм исправления отступов.

## ✅ Функции расширения:

- ✅ yamllint - проверка синтаксиса YAML
- ✅ ansible-lint - проверка Ansible best practices
- ✅ pre-commit - форматирование через hooks (обязательно!)
- ✅ Встроенный fixer - fallback если pre-commit не сработал
- ✅ Визуализация родительских ключей
- ✅ Диагностика ошибок

## 🔧 Зачем нужен pre-commit?

Pre-commit обеспечивает:
- Единообразное форматирование в команде
- Автоматическое исправление мелких проблем
- Запуск множества проверок за раз
- Интеграцию с CI/CD
- Лучшее качество кода

## 📦 Установка pre-commit (если нужен)

### Linux/macOS:

```bash
# Через pip
pip3 install --user pre-commit

# Или через pipx (рекомендуется)
pipx install pre-commit

# Или через apt (Debian/Ubuntu/Astra)
sudo apt-get install pre-commit
```

### Windows:

```bash
pip install pre-commit
```

### Проверка:

```bash
pre-commit --version
# Должно вывести: pre-commit 3.x.x
```

## 🎯 Настройка pre-commit в проекте

Если хотите использовать pre-commit:

### 1. Создайте `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
        args: ['--unsafe']

  - repo: https://github.com/adrienverge/yamllint
    rev: v1.33.0
    hooks:
      - id: yamllint

  - repo: https://github.com/ansible/ansible-lint
    rev: v6.22.0
    hooks:
      - id: ansible-lint
        files: \.(yaml|yml)$
```

### 2. Установите hooks:

```bash
pre-commit install
```

### 3. Проверка работы:

```bash
# Запуск на одном файле
pre-commit run --files test.yml

# Запуск на всех файлах
pre-commit run --all-files
```

## 🔄 Как работает интеграция в расширении

```
┌────────────────────────────────────────┐
│ Расширение проверяет отступы           │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│ Есть .pre-commit-config.yaml?          │
├────────────────────────────────────────┤
│ ❌ Нет → Встроенный fixer              │
│ ✅ Да  → Проверяем pre-commit          │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│ Pre-commit установлен?                 │
├────────────────────────────────────────┤
│ ❌ Нет → Встроенный fixer              │
│ ✅ Да  → Запускаем pre-commit          │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│ Pre-commit успешно исправил?           │
├────────────────────────────────────────┤
│ ✅ Да  → Показываем результат          │
│ ❌ Нет → Встроенный fixer (fallback)   │
└────────────────────────────────────────┘
```

## 💡 Рекомендации

### Для индивидуальной работы:
**НЕ нужен pre-commit** - встроенный fixer справится отлично!

### Для командной работы:
**Настройте pre-commit** чтобы все в команде использовали одинаковое форматирование.

### Для CI/CD:
**Используйте pre-commit** в GitHub Actions / GitLab CI для автоматической проверки.

## 🚫 Сообщение "Pre-commit failed" - это нормально!

Если вы видите в консоли:
```
[IndentFixer] Pre-commit execution failed, falling back to internal fixer
```

Это **не ошибка** - расширение просто использует встроенный алгоритм.

## ✅ Итог

- **Для работы расширения pre-commit НЕ нужен**
- yamllint + ansible-lint = достаточно для полной функциональности
- Pre-commit - бонусная функция для продвинутых пользователей
- Встроенный fixer работает отлично без pre-commit

## 📚 Дополнительная информация

- [Pre-commit документация](https://pre-commit.com/)
- [Pre-commit hooks список](https://pre-commit.com/hooks.html)
- [Ansible-lint pre-commit hook](https://github.com/ansible/ansible-lint#pre-commit)
