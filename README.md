# 🛡️ Ansible Lint Helper

VS Code extension for comprehensive Ansible code linting with inline errors, bilingual messages (EN/RU), and one-click auto-fix.

![Version](https://img.shields.io/badge/version-1.0.5-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![VS Code](https://img.shields.io/badge/vscode-%3E%3D1.60.0-blue)

## Features

- **Three-level linting** — `yamllint` → `pre-commit` → `ansible-lint` run sequentially
- **Inline errors** — underlines in the editor with severity indicators
- **Side panel** — errors grouped by file, collapsible, clickable navigation
- **Bilingual messages** — every error shows both English and Russian explanation
- **Filter by severity** — toggle Errors / Warnings / Info with counts
- **Auto-fix** — Fix File and Fix All buttons (pre-commit + ansible-lint --fix)
- **Quick Fix (💡)** — lightbulb menu with instant fixes for common issues
- **Ignore rules** — one-click ignore, adds to `.yamllint` or `.ansible-lint` automatically
- **Linter toggles** — enable/disable each linter independently
- **UI scaling** — adjustable panel zoom (50–150%), updates in real time
- **Auto-detection** — finds tools in venv, pipx, system PATH; ships default configs

## Requirements

```bash
pip install yamllint ansible ansible-lint pre-commit
```

Optional — initialize pre-commit hooks in your project:

```bash
pre-commit install
```

## Quick Start

1. Open an Ansible project in VS Code
2. Click the **shield icon (🛡️A)** in the Activity Bar
3. Press **Check File** or **Check All**
4. Click on any error to jump to the line in the editor

## Commands

| Command | Description |
|---------|-------------|
| `Ansible Lint: Run on Current File` | Lint the active file |
| `Ansible Lint: Run on All Files` | Lint all YAML/Ansible files in workspace |
| `Ansible Lint: Fix Current File` | Auto-fix the active file |
| `Ansible Lint: Run pre-commit` | Run pre-commit hooks only |
| `Ansible Lint: Ignore Rule` | Add rule to ignore list |
| `Ansible Lint: Open Settings` | Open extension settings |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `enableYamllint` | `true` | Enable yamllint checks |
| `enablePreCommit` | `true` | Enable pre-commit checks |
| `enableAnsibleLint` | `true` | Enable ansible-lint checks |
| `autoFixOnSave` | `false` | Auto-fix on file save |
| `lineLength` | `150` | Max line length for yamllint (80–500) |
| `indentSpaces` | `2` | Indentation: 2 or 4 spaces |
| `uiScale` | `100` | Panel zoom level (50–150%) |
| `executablePath` | `""` | Custom path to ansible-lint |
| `preCommitExecutable` | `""` | Custom path to pre-commit |
| `yamllintExecutable` | `""` | Custom path to yamllint |

All settings are under the `ansible-lint.*` namespace.

## How It Works

```
Check File / Check All
        ↓
  yamllint  →  pre-commit  →  ansible-lint
        ↓
  Parser normalizes output → unified LintError model
        ↓
  Inline diagnostics (underlines in editor)
        +
  Side panel (grouped by file, filterable)
        ↓
  Quick Fix (💡) / Ignore / Auto-fix
```

## Project Structure

```
├── src/
│   ├── extension.ts           # Entry point, command registration
│   ├── executor.ts            # Runs external linter processes
│   ├── parser.ts              # Parses linter output + RU translations
│   ├── diagnosticsProvider.ts # Inline editor diagnostics
│   ├── webviewPanel.ts        # Side panel UI (HTML/CSS/JS)
│   ├── codeActionsProvider.ts # Quick Fix + Ignore Rule logic
│   ├── quickFixer.ts          # Instant fixes (spaces, indentation)
│   ├── ansibleLintFixer.ts    # ansible-lint --fix wrapper
│   ├── utils.ts               # Helpers
│   └── models/
│       └── lintError.ts       # Error model interface
├── defaults/                  # Default configs shipped with extension
├── resources/
│   └── icon.svg               # Activity bar icon
├── package.json
└── tsconfig.json
```

## Development

```bash
npm install       # Install dependencies
npm run compile   # Build
npm run watch     # Watch mode
# Press F5 in VS Code to launch Extension Development Host
```

## Build VSIX

```bash
npx @vscode/vsce package
```

## License

[MIT](LICENSE)
