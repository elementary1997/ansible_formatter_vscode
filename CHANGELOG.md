# Change Log

All notable changes to the "Ansible Lint Helper" extension will be documented in this file.

## [1.0.5] - 2026-02-07

### New Features

#### 🌐 Bilingual Error Messages (EN/RU)
- Every error now shows both English and Russian explanation
- **EN:** and **RU:** text labels next to each message
- Proper baseline alignment of labels with error text

#### 🛡️ New Extension Icon
- Shield with letter "A" icon in the Activity Bar

#### 🔧 UI Scale Setting
- New `ansible-lint.uiScale` setting (50–150%)
- **Real-time update** — scale changes instantly without restart

#### 🎨 UI Improvements
- More compact error display with reduced padding
- Error statistics with severity icons: ❌ Errors, ⚠️ Warnings, ℹ️ Info
- Improved `[source]` badge contrast for better readability
- Full file path shown on hover over file headers

#### 📁 Default Config Improvements
- Linter config files (`.yamllint`, `.ansible-lint`, `.pre-commit-config.yaml`) excluded from all checks by default
- Default configs include common service directories in exclude lists

### Bug Fixes
- Fixed `ansible-lint --fix` exit code 8 (warnings) shown as error
- Fixed HTML entities (`&nbsp;`) displayed as text in statistics
- Removed unnecessary flag icons from language switcher

---

## [1.0.4] - 2026-02-06

### New Features

#### 🔍 Error Filtering by Severity
- **Filter buttons** to show only specific error types:
  - `All` — show all errors (default)
  - `❌ Errors` — show only errors
  - `⚠️ Warnings` — show only warnings
  - `ℹ️ Info` — show only info messages
- Each button shows count of matching items
- Errors remain **grouped by file** (collapsible)
- Filter preference is saved and restored

---

## [1.0.3] - 2026-02-06

### New Features

#### 📦 Smart Caching
- **File content caching** - results are cached based on file hash (MD5)
- **Skips unchanged files** - if file wasn't modified, uses cached results
- **"Using cached results"** notification when cache is used
- **Clear Cache** command to force re-check all files
- **Cache auto-invalidation** after Fix operations

#### ⚙️ GUI Settings
- **Settings button (⚙️)** in the panel - opens VSCode settings filtered to ansible-lint
- New configurable options:
  - `ansible-lint.useCache` (default: true) - enable/disable caching
  - `ansible-lint.lineLength` (default: 150) - max line length for yamllint
  - `ansible-lint.indentSpaces` (default: 2) - indentation spaces (2 or 4)
- Settings are applied automatically when no workspace config exists
- Workspace config files (`.yamllint`, `.ansible-lint`) take priority over VSCode settings

#### 🛠️ New Commands
- `Ansible Lint: Clear Cache` - clear all cached linting results
- `Ansible Lint: Open Settings` - quick access to extension settings

---

## [1.0.2] - 2026-02-06

### New Features

#### 🚫 Ignore Rule Support
- **Ignore button** on each error - adds rule to appropriate config file
  - `[yamllint]` errors → added to `.yamllint` as `rule: disable`
  - `[ansible-lint]` errors → added to `.ansible-lint` skip_list
  - `[pre-commit]` errors → shows manual edit instructions
- **Smart re-check** after Ignore:
  - If last check was "Check File" → re-runs Check File
  - If last check was "Check All" → re-runs Check All

#### ⚙️ Linter Toggle Settings
- New settings to enable/disable individual linters:
  - `ansible-lint.enableYamllint` (default: true)
  - `ansible-lint.enablePreCommit` (default: true)
  - `ansible-lint.enableAnsibleLint` (default: true)

#### 📁 Collapsible File Groups
- When using "Check All", errors are grouped by file
- Click on file header (▼/►) to collapse/expand errors
- Shows error count per file

#### 🎛️ UI Improvements
- Renamed buttons: "Run" → "Check File", removed "Clear", added "Fix File"
- Button order: `Check File` | `Check All` | `Fix File` | `Fix All`
- More compact error display (removed explicit severity badges)
- Russian detailed explanations for all rules (yamllint, ansible-lint, pre-commit)

#### 🔧 Bug Fixes
- Fixed pre-commit path duplication issue (test_extension/test_extension/...)
- Fixed Ignore not working for yamllint rules (was adding to wrong config)
- Improved error parsing for all linter output formats

---

## [1.0.0] - 2026-02-06

### Initial Release

#### Features
- 🔍 **Three-level code checking:**
  - `yamllint` - YAML syntax and style validation
  - `pre-commit` - Additional hooks (trailing-whitespace, end-of-file-fixer, etc.)
  - `ansible-lint` - Ansible best practices validation

- 💡 **Inline error display:**
  - Red/yellow squiggly lines in editor
  - Detailed error messages with rule names
  - Line and column precision

- 🎯 **Quick Fix support:**
  - Lightbulb menu (💡) for fixable errors
  - One-click fixes for common issues
  - Hybrid approach: quick fixes + ansible-lint --fix

- 📊 **Side panel with results:**
  - Grouped by file and check type
  - Click to navigate to error location
  - Error statistics (errors, warnings, info)

- 🔧 **Auto-fix capabilities:**
  - **Fix All** button runs:
    1. pre-commit auto-fixes (trailing spaces, line endings, etc.)
    2. ansible-lint --fix (Ansible-specific issues)
    3. Auto re-check to show remaining errors

- ⚙️ **Flexible configuration:**
  - Custom paths for ansible-lint, yamllint, pre-commit
  - Auto-fix on save option
  - Auto-detection in venv, pipx, system paths

- 🎮 **User-friendly controls:**
  - **Run** - Check current file
  - **Check All** - Check entire workspace
  - **Fix All** - Auto-fix all issues
  - **Clear** - Clear results

#### Supported Tools
- `yamllint` - YAML linting
- `pre-commit` - Pre-commit hooks framework
- `ansible-lint` - Ansible playbook linting

#### Documentation
- Installation guides for different platforms
- Pre-commit setup instructions
- yamllint configuration for Ansible
- Testing guidelines

#### Known Limitations
- Pre-commit with ansible-lint hook doesn't work on Windows (use built-in ansible-lint instead)
- Requires Python and pip to install linting tools
- ANSI color codes are stripped from output

---

## Future Plans

### Planned for 1.1.0
- [ ] Auto-run on file save option
- [ ] Custom rule severity mapping
- [ ] Performance improvements for large workspaces
- [ ] Multi-root workspace support

### Planned for 1.2.0
- [ ] Integration with VSCode Tasks
- [ ] Watch mode for continuous linting
- [ ] Export errors to file (JSON/CSV)
