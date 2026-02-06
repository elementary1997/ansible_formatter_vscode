# Решение проблемы "externally-managed-environment"

## 🚨 Проблема

На современных Debian/Ubuntu/Astra Linux появляется ошибка:

```
error: externally-managed-environment

This environment is externally managed
To install Python packages system-wide, try apt install python3-xyz
```

Это политика безопасности PEP 668, которая блокирует установку pip пакетов в системный Python.

## ✅ Решение (автоматическое)

Расширение теперь пробует **3 метода** установки по очереди:

### 1️⃣ Через `apt-get` (приоритет)

```bash
sudo apt-get install -y ansible yamllint ansible-lint
```

**Преимущества:**
- ✅ Официальные пакеты дистрибутива
- ✅ Автоматические обновления
- ✅ Не конфликтует с системой

**Недостаток:** Может потребовать sudo пароль

### 2️⃣ Через `pipx` (рекомендуется)

```bash
pipx install ansible
pipx install yamllint  
pipx install ansible-lint
```

**Преимущества:**
- ✅ Изолированные окружения
- ✅ Не требует sudo
- ✅ Не ломает систему

**Установка pipx:**
```bash
sudo apt install pipx
pipx ensurepath
```

### 3️⃣ Через `pip3` с флагом `--break-system-packages` (крайний случай)

```bash
pip3 install --user --break-system-packages ansible yamllint ansible-lint
```

**⚠️ Внимание:** Использует флаг `--break-system-packages`, что может быть рискованно.

## 🔧 Ручная установка (рекомендуется для Astra Linux)

### Вариант 1: apt-get (лучший для Astra)

```bash
# Обновляем репозитории
sudo apt-get update

# Устанавливаем пакеты
sudo apt-get install -y ansible yamllint ansible-lint

# Проверяем
ansible --version
yamllint --version
ansible-lint --version
```

### Вариант 2: pipx (изолированная установка)

```bash
# Устанавливаем pipx
sudo apt-get install -y pipx

# Добавляем pipx в PATH
pipx ensurepath

# Перезапускаем shell
exec $SHELL

# Устанавливаем пакеты
pipx install ansible --include-deps
pipx install yamllint
pipx install ansible-lint

# Проверяем
which ansible
which yamllint
which ansible-lint
```

### Вариант 3: venv (если нужна изоляция)

```bash
# Создаем venv
python3 -m venv ~/.local/venv-yaml-tools

# Активируем
source ~/.local/venv-yaml-tools/bin/activate

# Устанавливаем
pip install ansible yamllint ansible-lint

# Создаем симлинки
mkdir -p ~/.local/bin
ln -sf ~/.local/venv-yaml-tools/bin/ansible ~/.local/bin/
ln -sf ~/.local/venv-yaml-tools/bin/yamllint ~/.local/bin/
ln -sf ~/.local/venv-yaml-tools/bin/ansible-lint ~/.local/bin/

# Добавляем в PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Можно деактивировать venv
deactivate

# Проверяем (должно работать без venv)
yamllint --version
```

### Вариант 4: Обход ограничения (не рекомендуется)

```bash
# Удаляем файл-маркер (НА СВОЙ РИСК!)
sudo rm /usr/lib/python3.*/EXTERNALLY-MANAGED

# Теперь pip3 install --user будет работать
pip3 install --user ansible yamllint ansible-lint
```

## 🎯 Рекомендации для Astra Linux

**Лучший вариант: apt-get**
```bash
sudo apt-get install -y ansible yamllint ansible-lint
```

Если пакетов нет в репозиториях:

**Второй вариант: pipx**
```bash
sudo apt-get install -y pipx
pipx ensurepath
pipx install ansible --include-deps
pipx install yamllint
pipx install ansible-lint
```

## 🔄 После установки

```bash
# Проверьте что команды доступны
which ansible
which yamllint
which ansible-lint

# Проверьте версии
ansible --version
yamllint --version
ansible-lint --version

# Перезапустите VS Code
# Расширение должно работать!
```

## 📊 Как расширение выбирает метод

```
┌─────────────────────────────────────┐
│ Проверка: apt-get доступен?         │
├─────────────────────────────────────┤
│ ✅ Да  → sudo apt-get install       │
│ ❌ Нет → Следующий метод            │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ Проверка: pipx установлен?          │
├─────────────────────────────────────┤
│ ✅ Да  → pipx install (для каждого) │
│ ❌ Нет → Следующий метод            │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ Fallback: pip3 с --break-system     │
├─────────────────────────────────────┤
│ pip3 install --user --break-system  │
│ ⚠️ Может не работать на новых OS    │
└─────────────────────────────────────┘
```

## 💡 Полезные команды

```bash
# Проверка политики PEP 668
ls /usr/lib/python3.*/EXTERNALLY-MANAGED

# Проверка доступных пакетов в apt
apt-cache search yamllint
apt-cache search ansible-lint

# Список установленных через pipx
pipx list

# PATH для инструментов
# apt: /usr/bin/
# pipx: ~/.local/bin/
# pip --user: ~/.local/bin/
```

## 🆘 Если ничего не помогло

Создайте issue с выводом команд:

```bash
# Информация о системе
cat /etc/os-release
python3 --version
pip3 --version

# Проверка apt
apt-cache search yamllint

# Проверка pipx
which pipx
pipx --version

# Проверка PEP 668
ls -la /usr/lib/python3.*/EXTERNALLY-MANAGED
```

## 📚 Дополнительная информация

- [PEP 668 – Externally Managed Environments](https://peps.python.org/pep-0668/)
- [pipx документация](https://pypa.github.io/pipx/)
- [Debian Python Policy](https://www.debian.org/doc/packaging-manuals/python-policy/)
