# Repository Update System

A comprehensive TypeScript-based automation system for updating multiple repositories with Nx migrations using GitHub CLI integration and concurrent processing.

## Overview

This system automatically updates repositories with the latest Nx migrations by:
- Cloning repositories using GitHub CLI for enhanced authentication
- Detecting package managers and running appropriate commands
- Executing Nx migrations with automatic commit generation
- Creating pull requests with consistent formatting
- Providing real-time progress tracking through Nx TUI

## Directory Structure

```
tools/update-repos/
├── scripts/
│   ├── setup-repos.ts          # Clone repositories concurrently
│   └── update-repo.ts          # Update repos with migrations
├── config/
│   └── repos.json              # Repository configuration
├── repos/                      # Git clones (located in OS temp dir/updating-nx/repos)
│   ├── nx/                     # Nx repo clone
│   ├── ocean/                  # Ocean repo clone  
│   └── nx-examples/            # Nx examples repo clone
├── dist/                       # Compiled JavaScript (gitignored)
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## Prerequisites

- **GitHub CLI (`gh`)**: Required for repository cloning and PR creation
- **Node.js**: Runtime environment for compiled scripts
- **TypeScript**: Automatically compiled by Nx

## Configuration

Repository settings are defined in `config/repos.json`:

```json
{
  "repositories": {
    "nx": {
      "repo": "nrwl/nx",
      "branch": "master",
      "packageManager": "pnpm"
    },
    "ocean": {
      "repo": "nrwl/ocean", 
      "branch": "main",
      "packageManager": "npm"
    },
    "nx-examples": {
      "repo": "nrwl/nx-examples",
      "branch": "main", 
      "packageManager": "npm"
    }
  }
}
```

## Usage

### Initial Setup

Clone all repositories concurrently:
```bash
nx run setup-update-repos
```

### Update Individual Repository

Update a specific repository:
```bash
nx run update-nx-repo
nx run update-ocean-repo  
nx run update-nx-examples-repo
```

### Update All Repositories

Update all repositories with TUI progress tracking:
```bash
nx run update-all-repos
```

## How It Works

### 1. Repository Setup (`setup-repos.ts`)

- Uses GitHub CLI (`gh repo clone`) for authentication
- Clones all repositories concurrently using Promise.all()
- Checks out the configured main branch for each repo
- Removes existing clones to ensure clean state

### 2. Migration Process (`update-repo.ts`)

The update process follows this workflow:

1. **Git Setup**:
   ```bash
   git fetch origin
   git checkout -B upnx origin/{mainBranch}
   ```

2. **Package Manager Detection**:
   - Automatically detects based on lockfiles:
     - `pnpm-lock.yaml` → pnpm
     - `yarn.lock` → yarn
     - `bun.lockb` → bun
     - `package-lock.json` → npm
     - Default fallback → npm

3. **Dependency Installation**:
   ```bash
   # Example for npm:
   npm install
   ```

4. **Version Detection**:
   ```bash
   node -e "console.log(require('nx/package.json').version)"
   ```

5. **Migration Execution**:
   ```bash
   # Example for npm:
   npx nx migrate next
   npm install  # Install updated dependencies
   npx nx migrate --run-migrations --create-commits
   ```

6. **Git Operations**:
   ```bash
   git push -u origin upnx --force
   gh pr create --title "chore(repo): update nx to {version}" \
                --body "Updating Nx from {fromVersion} to {toVersion}"
   gh pr view upnx --web  # Opens in browser
   ```

### 3. Automatic Commit Generation

The system uses Nx's `--create-commits` flag to automatically generate individual commits for each migration step, providing:
- Clean git history with descriptive commit messages
- Individual commits per migration for easy rollback
- Professional commit formatting by Nx

## Package Manager Commands

The system automatically generates appropriate commands based on the detected package manager:

| Package Manager | Install | Migrate | Run Migrations |
|----------------|---------|---------|----------------|
| npm | `npm install` | `npx nx migrate next` | `npx nx migrate --run-migrations --create-commits` |
| pnpm | `pnpm install` | `pnpm exec nx migrate next` | `pnpm exec nx migrate --run-migrations --create-commits` |
| yarn | `yarn install` | `yarn nx migrate next` | `yarn nx migrate --run-migrations --create-commits` |
| bun | `bun install` | `bun nx migrate next` | `bun nx migrate --run-migrations --create-commits` |

## Features

### Concurrent Operations
- Repository cloning happens in parallel
- Individual repository updates can run simultaneously
- Nx TUI shows progress for each repository separately

### Verbose Output
The system provides detailed progress information:
- 🔄 Step descriptions with emojis
- 📝 Command execution details
- ✅ Success confirmations
- ❌ Failure notifications with error codes
- 📦 Version information display
- 🔍 Package manager detection
- ⚙️ Configuration details

### Error Handling
- Comprehensive error catching and reporting
- Graceful fallbacks for version detection
- Continues processing other repositories if one fails
- Non-blocking PR creation failures

### Git Workflow
- Proper remote tracking with `git fetch origin`
- Clean branch creation from remote main branch
- Force push support for reliable branch management
- Automatic cleanup of migrations.json

## Pull Request Format

All pull requests are created with consistent formatting:

- **Title**: `chore(repo): update nx to {version}`
- **Description**: `Updating Nx from {fromVersion} to {toVersion}`
- **Base Branch**: Configured main branch (master/main)
- **Head Branch**: `upnx`

Example:
- **Title**: `chore(repo): update nx to 19.6.2`
- **Description**: `Updating Nx from 19.5.1 to 19.6.2`

## Nx Targets

The system integrates with Nx through these targets:

```json
{
  "setup-update-repos": "Initialize repository clones (concurrent)",
  "update-nx-repo": "Update Nx repository with verbose output",
  "update-ocean-repo": "Update Ocean repository with verbose output", 
  "update-nx-examples-repo": "Update Nx examples repository with verbose output",
  "update-all-repos": "Update all repositories (TUI progress tracking)",
  "compile-update-repos": "Compile TypeScript scripts (automatic dependency)"
}
```

## TypeScript Compilation

- Scripts are automatically compiled to JavaScript before execution
- Compilation is cached by Nx for better performance
- All targets depend on the compilation step
- Compiled output is stored in `dist/` and gitignored

## Troubleshooting

### GitHub CLI Authentication
Ensure you're authenticated with GitHub CLI:
```bash
gh auth status
gh auth login
```

### Missing Dependencies
If version detection fails, ensure repositories have Nx installed:
```bash
# In the repository directory
npm install nx
# or
pnpm add nx
```

### Permission Issues
If push fails, check your GitHub permissions for the target repositories.

### Pre-existing Branches
The system uses `--force` when pushing to handle existing `upnx` branches automatically.

## Adding New Repositories

To add a new repository to the update system:

1. Add configuration to `config/repos.json`:
   ```json
   {
     "repositories": {
       "new-repo": {
         "repo": "nrwl/new-repo",
         "branch": "main",
         "packageManager": "npm"
       }
     }
   }
   ```

2. Add Nx target to `project.json`:
   ```json
   {
     "update-new-repo": {
       "executor": "nx:run-commands",
       "dependsOn": ["compile-update-repos"],
       "options": {
         "command": "node tools/update-repos/dist/update-repo.js new-repo"
       }
     }
   }
   ```

3. Update the `update-all-repos` target dependencies:
   ```json
   {
     "update-all-repos": {
       "dependsOn": ["update-nx-repo", "update-ocean-repo", "update-nx-examples-repo", "update-new-repo"]
     }
   }
   ```

## Performance

- **Concurrent cloning**: All repositories are cloned simultaneously
- **Parallel updates**: When using `update-all-repos`, each repository updates independently
- **TypeScript caching**: Compiled scripts are cached by Nx
- **Efficient version detection**: Direct package.json reading instead of CLI commands

## Security

- Uses GitHub CLI for authenticated operations
- Repository clones are isolated in OS temp directory (`os.tmpdir()/updating-nx/repos`)
- No secrets or tokens are stored in configuration files
- Force push is scoped to update branches only (`upnx`)

## Maintenance

The system is designed to be low-maintenance:
- Repository configurations are centralized in `repos.json`
- Package manager detection is automatic
- Error handling prevents system-wide failures
- Nx handles compilation and caching automatically