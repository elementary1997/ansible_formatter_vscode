# PowerShell script для создания VSIX пакета
# Использование: .\build.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Ansible Lint Helper - VSIX Package Builder   " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Переход в корень проекта
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Проверка наличия node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/4] Dependencies OK" -ForegroundColor Green
}

Write-Host ""

# Компиляция TypeScript
Write-Host "[2/4] Compiling TypeScript..." -ForegroundColor Yellow
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Compilation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Compilation successful!" -ForegroundColor Green

Write-Host ""

# Получение версии из package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version
$name = $packageJson.name

Write-Host "[3/4] Creating VSIX package..." -ForegroundColor Yellow
Write-Host "Name: $name" -ForegroundColor Cyan
Write-Host "Version: $version" -ForegroundColor Cyan

# Создание VSIX в build/ каталоге
$outputFile = "build\$name-$version.vsix"
npx vsce package --out $outputFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Package creation failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Проверка результата
if (Test-Path $outputFile) {
    $fileSize = (Get-Item $outputFile).Length / 1MB
    Write-Host "[4/4] SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  Package created successfully!                " -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "File: $outputFile" -ForegroundColor Cyan
    Write-Host "Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test: code --install-extension $outputFile" -ForegroundColor White
    Write-Host "2. Share: Send .vsix file to users" -ForegroundColor White
    Write-Host "3. Publish: npm run publish (requires PAT)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "ERROR: Package file not found!" -ForegroundColor Red
    exit 1
}
