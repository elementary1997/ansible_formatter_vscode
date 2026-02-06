# Установка и настройка yamllint

`yamllint` - это линтер для YAML файлов, который проверяет синтаксис и стиль форматирования.

## Установка

### Вариант 1: Через pip (глобально)

```bash
pip install yamllint
```

### Вариант 2: Через pip (пользовательский)

```bash
pip install --user yamllint
```

### Вариант 3: В виртуальном окружении проекта

```bash
# Создать venv если его нет
python -m venv venv

# Активировать venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Установить yamllint
pip install yamllint
```

### Вариант 4: Через pipx (изолированно)

```bash
# Установить pipx если его нет
pip install --user pipx
pipx ensurepath

# Установить yamllint через pipx
pipx install yamllint
```

## Проверка установки

```bash
yamllint --version
```

Должен вывести версию, например: `yamllint 1.35.1`

## Конфигурация

Расширение использует файл `.yamllint` в корне проекта для конфигурации правил.

Наша конфигурация оптимизирована для Ansible проектов:

- ✅ **Синтаксис**: Проверка корректности YAML
- ✅ **Отступы**: 2 пробела (стандарт Ansible)
- ✅ **Trailing spaces**: Запрещены
- ✅ **Длина строк**: До 160 символов (предупреждение)
- ✅ **Truthy values**: `yes/no`, `true/false`
- ✅ **Octal values**: Разрешены явные восьмеричные (для прав доступа)
- ✅ **Кавычки**: Гибкие правила для Ansible

### Ручной запуск yamllint

```bash
# Проверить конкретный файл
yamllint main.yml

# Проверить все YAML файлы в директории
yamllint .

# С указанием конфига
yamllint -c .yamllint main.yml

# Формат для парсинга (используется расширением)
yamllint -f parsable main.yml
```

## Интеграция с расширением

Расширение автоматически:

1. ✅ Запускает `yamllint` **первым** (перед pre-commit и ansible-lint)
2. ✅ Использует конфигурацию из `.yamllint`
3. ✅ Отображает ошибки в секции **"YAMLLINT CHECKS"**
4. ✅ Показывает inline ошибки в редакторе
5. ✅ Предоставляет ссылки на документацию правил

## Порядок проверок

Расширение запускает линтеры в следующем порядке:

1. **yamllint** - Проверка YAML синтаксиса и стиля
2. **pre-commit** - Дополнительные хуки (trailing-whitespace, end-of-file-fixer и т.д.)
3. **ansible-lint** - Ansible best practices

Это гарантирует, что сначала проверяется базовый синтаксис YAML, затем общие правила, и только потом специфичные для Ansible.

## Документация

- [Официальный сайт yamllint](https://yamllint.readthedocs.io/)
- [Правила yamllint](https://yamllint.readthedocs.io/en/stable/rules.html)
- [Конфигурация](https://yamllint.readthedocs.io/en/stable/configuration.html)

## Troubleshooting

### yamllint не найден

Если расширение не находит `yamllint`, проверьте:

1. Установлен ли yamllint: `yamllint --version`
2. Добавлен ли путь в PATH
3. Для Windows: Убедитесь, что Scripts папка Python в PATH

### Настройка кастомного пути

В `settings.json` VSCode можно указать путь:

```json
{
  "ansible-lint.yamllintPath": "/full/path/to/yamllint"
}
```

### Слишком много предупреждений

Отредактируйте `.yamllint` в корне проекта:

```yaml
rules:
  line-length:
    max: 200  # Увеличить лимит
    level: warning

  comments:
    level: warning  # Или disable
```
