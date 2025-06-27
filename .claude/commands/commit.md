# Commit Command

## Description

Create a git commit following Nx repository standards and validation requirements.

## Usage

```bash
/commit [message]
```

## What this command does:

1. **Pre-commit validation**: Runs the full validation suite (`pnpm nx prepush`) to ensure code quality
2. **Formatting**: Automatically formats changed files with Prettier
3. **Testing**: Runs tests on affected projects to validate changes
4. **Commit creation**: Creates a well-formed commit with proper message formatting (without co-author attribution)
5. **Status reporting**: Provides clear feedback on the commit process

## Workflow:

1. Format any modified files with Prettier
2. Run the prepush validation suite
3. If validation passes, stage relevant changes
4. Create commit with descriptive message
5. Provide summary of what was committed

## Commit Message Format:

- Use conventional commit format when appropriate
- Include scope (e.g., `feat(core):`, `fix(angular):`, `docs(nx):`)
- Keep first line under 72 characters
- Include detailed description if needed

## Examples:

- `/commit "feat(core): add new project graph visualization"`
- `/commit "fix(react): resolve build issues with webpack config"`
- `/commit "docs(nx): update getting started guide"`

## Validation Requirements:

- All tests must pass
- Code must be properly formatted
- No linting errors
- E2E tests for affected areas should pass
