# Change Log

All notable changes to the "Ansible Lint Helper" extension will be documented in this file.

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
- [ ] Support for ansible-lint configuration files (.ansible-lint)
- [ ] Ignore specific rules functionality
- [ ] Custom rule severity levels
- [ ] Performance improvements for large workspaces

### Planned for 1.2.0
- [ ] Integration with VSCode Tasks
- [ ] Watch mode for continuous linting
- [ ] Multi-root workspace support
- [ ] Detailed error documentation tooltips
