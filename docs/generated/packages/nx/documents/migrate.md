---
title: 'migrate - CLI command'
description:
  'Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.'
---

# migrate

Creates a migrations file or runs migrations from the migrations file.

- Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
- Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.

## Usage

```shell
nx migrate [packageAndVersion]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Update all Nx plugins to "latest". This will generate migrations.json:

```shell
 nx migrate latest
```

Update all Nx plugins to "9.0.0". This will generate migrations.json:

```shell
 nx migrate 9.0.0
```

Update @nx/workspace and generate the list of migrations starting with version 8.0.0 of @nx/workspace and @nx/node, regardless of what is installed locally:

```shell
 nx migrate @nx/workspace@9.0.0 --from="@nx/workspace@8.0.0,@nx/node@8.0.0"
```

Update @nx/workspace to "9.0.0". If it tries to update @nx/react or @nx/angular, use version "9.0.1":

```shell
 nx migrate @nx/workspace@9.0.0 --to="@nx/react@9.0.1,@nx/angular@9.0.1"
```

Update another-package to "12.0.0". This will update other packages and will generate migrations.json file:

```shell
 nx migrate another-package@12.0.0
```

Collect package updates and migrations in interactive mode. In this mode, the user will be prompted whether to apply any optional package update and migration:

```shell
 nx migrate latest --interactive
```

Collect package updates and migrations starting with version 14.5.0 of "nx" (and Nx first-party plugins), regardless of what is installed locally, while excluding migrations that should have been applied on previous updates:

```shell
 nx migrate latest --from=nx@14.5.0 --exclude-applied-migrations
```

Run migrations from the provided migrations.json file. You can modify migrations.json and run this command many times:

```shell
 nx migrate --run-migrations=migrations.json
```

Create a dedicated commit for each successfully completed migration. You can customize the prefix used for each commit by additionally setting --commit-prefix="PREFIX_HERE ":

```shell
 nx migrate --run-migrations --create-commits
```

## Options

### commitPrefix

Type: `string`

Default: `chore: [nx migration] `

Commit prefix to apply to the commit for each migration, when --create-commits is enabled

### createCommits

Type: `boolean`

Default: `false`

Automatically create a git commit after each migration runs

### excludeAppliedMigrations

Type: `boolean`

Default: `false`

Exclude migrations that should have been applied on previous updates. To be used with --from

### from

Type: `string`

Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nx/react@16.0.0,@nx/js@16.0.0")

### help

Type: `boolean`

Show help

### ifExists

Type: `boolean`

Default: `false`

Run migrations only if the migrations file exists, if not continues successfully

### interactive

Type: `boolean`

Default: `false`

Enable prompts to confirm whether to collect optional package updates and migrations

### packageAndVersion

Type: `string`

The target package and version (e.g, @nx/workspace@16.0.0)

### runMigrations

Type: `string`

Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json)

### to

Type: `string`

Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nx/react@16.0.0,@nx/js@16.0.0")

### version

Type: `boolean`

Show version number
