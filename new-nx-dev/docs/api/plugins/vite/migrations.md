---
title: '@nx/vite Migrations'
description: 'Complete reference for all @nx/vite migration commands'
sidebar_label: Migrations
---

# @nx/vite Migrations

The @nx/vite plugin provides various migrations to help you update your vite projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19-6-0-add-depends-on-for-preview-server`

Add dependsOn: [build] to preview targets using preview-server

**Version:** `19.6.0-beta.0`

**Implementation:** `./src/migrations/update-19-6-0/add-depends-on-for-preview`

### `update-20-0-4`

Add gitignore entry for temporary vite config files.

**Version:** `20.0.4-beta.0`

**Implementation:** `./src/migrations/update-20-0-4/add-vite-temp-files-to-git-ignore`

### `update-20-0-6`

Add gitignore entry for temporary vite config files and remove previous incorrect glob.

**Version:** `20.0.6-beta.0`

**Implementation:** `./src/migrations/update-20-0-4/add-vite-temp-files-to-git-ignore`

### `update-20-3-0`

Add gitignore entry for temporary vitest config files.

**Version:** `20.3.0-beta.2`

**Implementation:** `./src/migrations/update-20-3-0/add-vitest-temp-files-to-git-ignore`

### `update-20.5.0`

Update dependencies to version 20.5.0

**Version:** `20.5.0`

#### Package Updates

This migration updates the following packages:

| Package           | Version  | Type     |
| ----------------- | -------- | -------- |
| `vite`            | `^6.0.0` | packages |
| `vite-plugin-dts` | `~4.5.0` | packages |

### `update-20-5-0-install-jiti`

Install jiti as a devDependency to allow vite to parse TS postcss files.

**Version:** `20.5.0-beta.2`

**Implementation:** `./src/migrations/update-20-5-0/install-jiti`

### `eslint-ignore-vite-temp-files`

Add vite config temporary files to the ESLint configuration ignore patterns if ESLint is used.

**Version:** `20.5.0-beta.3`

**Implementation:** `./src/migrations/update-20-5-0/eslint-ignore-vite-temp-files`

### `update-20-5-0-update-resolve-conditions`

Update resolve.conditions to include defaults that are no longer provided by Vite.

**Version:** `20.5.0-beta.3`

**Implementation:** `./src/migrations/update-20-5-0/update-resolve-conditions`

### `update-20.7.1`

Update dependencies to version 20.7.1

**Version:** `20.7.1`

#### Package Updates

This migration updates the following packages:

| Package                         | Version   | Type     |
| ------------------------------- | --------- | -------- |
| `@analogjs/vite-plugin-angular` | `~1.14.1` | packages |
| `@analogjs/vitest-angular`      | `~1.14.1` | packages |

### `update-21.1.2`

Update dependencies to version 21.1.2

**Version:** `21.1.2`

#### Package Updates

This migration updates the following packages:

| Package                    | Version   | Type     |
| -------------------------- | --------- | -------- |
| `@analogjs/vitest-angular` | `~1.16.1` | packages |

### `update-21.2.0`

Update dependencies to version 21.2.0

**Version:** `21.2.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version   | Type     |
| ------------------------------- | --------- | -------- |
| `@analogjs/vite-plugin-angular` | `~1.17.1` | packages |
| `@analogjs/vitest-angular`      | `~1.17.1` | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/vite@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/vite@latest --dry-run
```
