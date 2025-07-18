# Repository Update System

Automated system for updating multiple repositories with Nx migrations.

## Usage

**Initial Setup** - Clone all repositories:

```bash
nx run update-repos:setup-update-repos
```

**Update Individual Repository**:

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

## How It Works

**Setup Phase**:

1. Uses GitHub CLI to clone repositories to OS temp directory
2. Configures repositories from `config/repos.json`

**Update Process**:

1. Create update branch (`upnx`) from remote main branch
2. Detect package manager (pnpm/yarn/bun/npm) from lockfiles
3. Run `nx migrate next` to update to latest Nx version
4. Install updated dependencies
5. Run `nx migrate --run-migrations --create-commits` (auto-generates commits)
6. Clean up `migrations.json` file after successful migration
7. Push branch to remote
8. Create new PR or update existing PR with current version info
9. Open PR in browser

**PR Management**:

- Creates new PRs when none exist for the update branch
- Updates existing PRs with latest version information
- Always opens PRs in browser regardless of create vs update
