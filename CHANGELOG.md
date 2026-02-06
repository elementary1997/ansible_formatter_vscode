# Change Log

All notable changes to the "Ansible Lint Helper" extension will be documented in this file.

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
- [ ] Error filtering by severity/source

### Planned for 1.2.0
- [ ] Integration with VSCode Tasks
- [ ] Watch mode for continuous linting
- [ ] Multi-root workspace support
- [ ] Export errors to file (JSON/CSV)
