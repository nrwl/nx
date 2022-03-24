---
title: "migrate - CLI command"
description: "Creates a migrations file or runs migrations from the migrations file.
- Migrate packages and create migrations.json (e.g., nx migrate @nrwl/workspace@latest)
- Run migrations (e.g., nx migrate --run-migrations=migrations.json)
"
---

# migrate

Creates a migrations file or runs migrations from the migrations file.

- Migrate packages and create migrations.json (e.g., nx migrate @nrwl/workspace@latest)
- Run migrations (e.g., nx migrate --run-migrations=migrations.json)

## Usage

```bash
nx migrate
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Update @nrwl/workspace to "next". This will update other packages and will generate migrations.json:

```bash
nx migrate next
```

Update @nrwl/workspace to "9.0.0". This will update other packages and will generate migrations.json:

```bash
nx migrate 9.0.0
```

Update @nrwl/workspace and generate the list of migrations starting with version 8.0.0 of @nrwl/workspace and @nrwl/node, regardless of what installed locally:

```bash
nx migrate @nrwl/workspace@9.0.0 --from="@nrwl/workspace@8.0.0,@nrwl/node@8.0.0"
```

Update @nrwl/workspace to "9.0.0". If it tries to update @nrwl/react or @nrwl/angular, use version "9.0.1":

```bash
nx migrate @nrwl/workspace@9.0.0 --to="@nrwl/react@9.0.1,@nrwl/angular@9.0.1"
```

Update another-package to "12.0.0". This will update other packages and will generate migrations.json file:

```bash
nx migrate another-package@12.0.0
```

Run migrations from the migrations.json file. You can modify migrations.json and run this command many times:

```bash
nx migrate --run-migrations=migrations.json
```

## Options

### from

Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nrwl/react:12.0.0,@nrwl/js:12.0.0")

### help

Show help

### packageAndVersion

The target package and version (e.g, @nrwl/workspace@13.0.0)

### runMigrations

Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json)

### to

Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nrwl/react:12.0.0,@nrwl/js:12.0.0")

### version

Show version number
