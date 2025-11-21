# Repository Update System

Automated system for updating multiple repositories with Nx migrations.

## Usage

**Update Individual Repository** (setup handled automatically):

```bash
nx run update-repos:update-nx-repo
nx run update-repos:update-ocean-repo
nx run update-repos:update-nx-examples-repo
nx run update-repos:update-nx-console-repo
```

**Update All Repositories**:

```bash
nx run update-repos:update-all-repos
```

Or using the convenient npm script:

```bash
pnpm update-all-repos
```

> **Note**: No separate setup step is required. Each update task automatically handles repository setup if needed.

## How It Works

**Automatic Setup** (if repository doesn't exist):

1. Uses GitHub CLI to clone repositories to OS temp directory
2. Configures repositories from `config/repos.json`
3. Skips setup if repository already exists (noop)

**Update Process**:

1. Create update branch (`upnx`) from remote main branch
2. Detect package manager (pnpm/yarn/bun/npm) from lockfiles
3. Run `nx migrate next` to update to latest Nx version
4. Install updated dependencies
5. Run `nx migrate --run-migrations --create-commits` (auto-generates commits)
6. Clean up `migrations.json` file after successful migration
7. Run `post-nx-update` script if it exists in package.json (optional)
8. Commit any changes from post-nx-update script separately
9. Run `nx reset` to clear cache (prevents prepush hook issues)
10. Push branch to remote (with `--no-verify` to skip git hooks)
11. Create new PR or update existing PR with current version info
12. Open PR in browser

**Post-Update Hook**:

- Repositories can define a `post-nx-update` script in their root package.json
- This script runs after Nx migrations complete but before pushing changes
- Any changes made by the script are committed separately
- If the script doesn't exist, the process continues normally (no failure)

**PR Management**:

- Creates new PRs when none exist for the update branch
- Updates existing PRs with latest version information
- Always opens PRs in browser regardless of create vs update
