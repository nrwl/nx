---
title: nx migrate
description: 'Creates a migrations file or runs migrations from the migrations file. - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest) - Run migrations (e.g., nx migrate --run-mi'
---

# `nx migrate`

Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.



## Usage

```bash
nx migrate [packageAndVersion] [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--commitPrefix` | string | Commit prefix to apply to the commit for each migration, when --create-commits is enabled. | `defaultCommitPrefix` |
| `--createCommits` | boolean | Automatically create a git commit after each migration runs. | `false` |
| `--excludeAppliedMigrations` | boolean | Exclude migrations that should have been applied on previous updates. To be used with --from. | `false` |
| `--from` | string | Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from= |  |
| `--ifExists` | boolean | Run migrations only if the migrations file exists, if not continues successfully. | `false` |
| `--interactive` | boolean | Enable prompts to confirm whether to collect optional package updates and migrations. | `false` |
| `--runMigrations` | string | Execute migrations from a file (when the file isn |  |
| `--to` | string | Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to= |  |
| `--verbose` | boolean | Enable verbose logging | `false` |



