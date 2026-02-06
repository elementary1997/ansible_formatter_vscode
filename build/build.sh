#!/bin/bash
# Bash script для создания VSIX пакета
# Использование: ./build.sh

set -e

echo "================================================"
echo "  Ansible Lint Helper - VSIX Package Builder   "
echo "================================================"
echo ""

# Переход в корень проекта
cd "$(dirname "$0")/.."

# Проверка наличия node_modules
if [ ! -d "node_modules" ]; then
    echo "[1/4] Installing dependencies..."
    npm install
else
    echo "[1/4] Dependencies OK ✓"
fi

echo ""

# Компиляция TypeScript
echo "[2/4] Compiling TypeScript..."
npm run compile
echo "Compilation successful! ✓"

echo ""

# Получение версии из package.json
VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")

echo "[3/4] Creating VSIX package..."
echo "Name: $NAME"
echo "Version: $VERSION"

# Создание VSIX в build/ каталоге
OUTPUT_FILE="build/${NAME}-${VERSION}.vsix"
npx vsce package --out "$OUTPUT_FILE"

echo ""

# Проверка результата
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "[4/4] SUCCESS! ✓"
    echo ""
    echo "================================================"
    echo "  Package created successfully!                "
    echo "================================================"
    echo ""
    echo "File: $OUTPUT_FILE"
    echo "Size: $FILE_SIZE"
    echo ""
    echo "Next steps:"
    echo "1. Test: code --install-extension $OUTPUT_FILE"
    echo "2. Share: Send .vsix file to users"
    echo "3. Publish: npm run publish (requires PAT)"
    echo ""
else
    echo "ERROR: Package file not found!"
    exit 1
fi
