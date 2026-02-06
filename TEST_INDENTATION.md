# Тест проверки отступов

## Проблемы в test_extension/main.yml

Расширение должно находить эти ошибки:

### Строка 9: app_name неправильный отступ
```yaml
vars:
  http_port: 80
  https_port: 443
app_name: myapp  # ❌ ОШИБКА! Должен быть:  app_name: myapp
```

**Исправление:**
```yaml
vars:
  http_port: 80
  https_port: 443
  app_name: myapp  # ✅ Правильно
```

### Строки 15-16: state и update_cache неправильные отступы
```yaml
- name: Install Apache
  apt:
    name: apache2
  state: present       # ❌ ОШИБКА! Должно быть внутри apt:
  update_cache: yes    # ❌ ОШИБКА!
```

**Исправление:**
```yaml
- name: Install Apache
  apt:
    name: apache2
    state: present     # ✅ Правильно
    update_cache: yes  # ✅ Правильно
```

### Строка 19: copy неправильный отступ
```yaml
- name: Copy configuration file
copy:              # ❌ ОШИБКА! Должно быть с отступом
  src: /tmp/config.conf
```

**Исправление:**
```yaml
- name: Copy configuration file
  copy:            # ✅ Правильно
    src: /tmp/config.conf
```

### Строка 24: Start service неправильный отступ
```yaml
- name: Start service  # ❌ ОШИБКА! Отступ 2 пробела, должно быть 4
  service:
```

**Исправление:**
```yaml
  - name: Start service  # ✅ Правильно (4 пробела или 0 если новая секция)
    service:
```

### Строка 34: owner неправильный отступ
```yaml
- name: Create directory
  file:
    path: /var/www/html
    state: directory
  owner: www-data  # ❌ ОШИБКА! Должно быть внутри file:
```

**Исправление:**
```yaml
- name: Create directory
  file:
    path: /var/www/html
    state: directory
    owner: www-data  # ✅ Правильно
```

## Как проверить

### 1. Вручную через командную строку:

```bash
cd test_extension

# yamllint
yamllint main.yml

# ansible-lint
ansible-lint main.yml

# pre-commit
pre-commit run --files main.yml
```

### 2. В расширении:

1. Откройте `test_extension/main.yml`
2. Откройте панель "YAML Indent"
3. Должны увидеть все ошибки в секции "Best Practices & Lint"

## Ожидаемый вывод yamllint

```
main.yml
  9:1   error    wrong indentation: expected 2 but found 0  (indentation)
  15:3  error    wrong indentation: expected 6 but found 4  (indentation)
  16:3  error    wrong indentation: expected 6 but found 4  (indentation)
  19:1  error    wrong indentation: expected 2 but found 0  (indentation)
  24:1  error    wrong indentation: expected 4 but found 2  (indentation)
  34:3  error    wrong indentation: expected 6 but found 4  (indentation)
```

## Правильный файл (исправленный)

```yaml
---
- name: Playbook with indentation errors
  hosts: webservers
  become: yes

  vars:
    http_port: 80
    https_port: 443
    app_name: myapp

  tasks:
    - name: Install Apache
      apt:
        name: apache2
        state: present
        update_cache: yes

    - name: Copy configuration file
      copy:
        src: /tmp/config.conf
        dest: /etc/app/config.conf
        mode: '0644'

    - name: Start service
      service:
        name: apache2
        state: started
        enabled: yes

    - name: Create directory
      file:
        path: /var/www/html
        state: directory
        owner: www-data

    - name: Install packages
      apt:
        name:
          - nginx
          - git
          - curl
        state: present
```

## Усиленные правила

Обновлены файлы:
- `.yamllint.yml` - строгие правила отступов
- `test_extension/.yamllint-config.yaml` - для pre-commit
- `test_extension/.pre-commit-config.yaml` - с флагом --strict

Теперь все ошибки отступов будут обнаружены!
