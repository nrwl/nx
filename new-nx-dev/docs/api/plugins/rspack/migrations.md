---
title: '@nx/rspack Migrations'
description: 'Complete reference for all @nx/rspack migration commands'
sidebar_label: Migrations
---

# @nx/rspack Migrations

The @nx/rspack plugin provides various migrations to help you update your rspack projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.3.0`

Update dependencies to version 19.3.0

**Version:** `19.3.0`

#### Package Updates

This migration updates the following packages:

| Package                 | Version  | Type     |
| ----------------------- | -------- | -------- |
| `@rspack/core`          | `^0.7.5` | packages |
| `@rspack/dev-server`    | `^0.7.5` | packages |
| `@rspack/plugin-minify` | `^0.7.5` | packages |

### `update-19.7.0`

Update dependencies to version 19.7.0

**Version:** `19.7.0`

#### Package Updates

This migration updates the following packages:

| Package                        | Version  | Type     |
| ------------------------------ | -------- | -------- |
| `@rspack/core`                 | `^1.0.0` | packages |
| `@rspack/dev-server`           | `^1.0.0` | packages |
| `@rspack/plugin-react-refresh` | `^1.0.0` | packages |

### `update-20.2.0`

Update dependencies to version 20.2.0

**Version:** `20.2.0`

#### Package Updates

This migration updates the following packages:

| Package              | Version  | Type     |
| -------------------- | -------- | -------- |
| `@rspack/core`       | `^1.1.5` | packages |
| `@rspack/dev-server` | `^1.0.9` | packages |

### `update-20-2-0-update-with-module-federation-import`

Update the withModuleFederation import use @nx/module-federation/rspack.

**Version:** `20.2.0-beta.3`

**Implementation:** `./src/migrations/update-20-2-0/migrate-with-mf-import-to-new-package`

### `ensure-nx-module-federation-package`

If workspace includes Module Federation projects, ensure the new @nx/module-federation package is installed.

**Version:** `20.3.0-beta.2`

**Implementation:** `./src/migrations/update-20-3-0/ensure-nx-module-federation-package`

### `update-20.5.0`

Update dependencies to version 20.5.0

**Version:** `20.5.0`

#### Package Updates

This migration updates the following packages:

| Package        | Version   | Type     |
| -------------- | --------- | -------- |
| `sass-loader`  | `^16.0.4` | packages |
| `@rspack/core` | `^1.2.2`  | packages |

### `update-21.0.1`

Update dependencies to version 21.0.1

**Version:** `21.0.1`

#### Package Updates

This migration updates the following packages:

| Package              | Version  | Type     |
| -------------------- | -------- | -------- |
| `@rspack/core`       | `^1.3.8` | packages |
| `@rspack/dev-server` | `^1.1.1` | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/rspack@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/rspack@latest --dry-run
```
