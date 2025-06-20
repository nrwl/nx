---
title: '@nx/eslint Migrations'
description: 'Complete reference for all @nx/eslint migration commands'
sidebar_label: Migrations
---

# @nx/eslint Migrations

The @nx/eslint plugin provides various migrations to help you update your eslint projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.5.0`

Update dependencies to version 19.5.0

**Version:** `19.5.0`

#### Package Updates

This migration updates the following packages:

| Package                                | Version   | Type     |
| -------------------------------------- | --------- | -------- |
| `@typescript-eslint/parser`            | `^7.16.0` | packages |
| `@typescript-eslint/eslint-plugin`     | `^7.16.0` | packages |
| `@typescript-eslint/utils`             | `^7.16.0` | packages |
| `@typescript-eslint/rule-tester`       | `^7.16.0` | packages |
| `@typescript-eslint/scope-manager`     | `^7.16.0` | packages |
| `@typescript-eslint/typescript-estree` | `^7.16.0` | packages |

### `update-typescript-eslint-v8.13.0`

Update TypeScript ESLint packages to v8.13.0 if they are already on v8

**Version:** `20.2.0-beta.5`

**Implementation:** `./src/migrations/update-20-2-0/update-typescript-eslint-v8-13-0`

### `add-file-extensions-to-overrides`

Update ESLint flat config to include .cjs, .mjs, .cts, and .mts files in overrides (if needed)

**Version:** `20.3.0-beta.1`

**Implementation:** `./src/migrations/update-20-3-0/add-file-extensions-to-overrides`

### `update-20.4.0-@typescript-eslint`

Update dependencies to version 20.4.0-@typescript-eslint

**Version:** `20.4.0-@typescript-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                | Version          | Type     |
| -------------------------------------- | ---------------- | -------- |
| `@typescript-eslint/eslint-plugin`     | `>8.0.0 <8.19.0` | requires |
| `typescript-eslint`                    | `^8.19.0`        | packages |
| `@typescript-eslint/eslint-plugin`     | `^8.19.0`        | packages |
| `@typescript-eslint/parser`            | `^8.19.0`        | packages |
| `@typescript-eslint/utils`             | `^8.19.0`        | packages |
| `@typescript-eslint/rule-tester`       | `^8.19.0`        | packages |
| `@typescript-eslint/scope-manager`     | `^8.19.0`        | packages |
| `@typescript-eslint/typescript-estree` | `^8.19.0`        | packages |

### `update-20.4.0-typescript-eslint`

Update dependencies to version 20.4.0-typescript-eslint

**Version:** `20.4.0-typescript-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                | Version          | Type     |
| -------------------------------------- | ---------------- | -------- |
| `typescript-eslint`                    | `>8.0.0 <8.19.0` | requires |
| `typescript-eslint`                    | `^8.19.0`        | packages |
| `@typescript-eslint/eslint-plugin`     | `^8.19.0`        | packages |
| `@typescript-eslint/parser`            | `^8.19.0`        | packages |
| `@typescript-eslint/utils`             | `^8.19.0`        | packages |
| `@typescript-eslint/rule-tester`       | `^8.19.0`        | packages |
| `@typescript-eslint/scope-manager`     | `^8.19.0`        | packages |
| `@typescript-eslint/typescript-estree` | `^8.19.0`        | packages |

### `update-20.7.0`

Update dependencies to version 20.7.0

**Version:** `20.7.0`

#### Package Updates

This migration updates the following packages:

| Package                  | Version   | Type     |
| ------------------------ | --------- | -------- |
| `eslint-config-prettier` | `^10.0.0` | packages |

### `update-21.2.0-@typescript-eslint`

Update dependencies to version 21.2.0-@typescript-eslint

**Version:** `21.2.0-@typescript-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                | Version          | Type     |
| -------------------------------------- | ---------------- | -------- |
| `@typescript-eslint/eslint-plugin`     | `>8.0.0 <8.29.0` | requires |
| `typescript-eslint`                    | `^8.29.0`        | packages |
| `@typescript-eslint/eslint-plugin`     | `^8.29.0`        | packages |
| `@typescript-eslint/parser`            | `^8.29.0`        | packages |
| `@typescript-eslint/utils`             | `^8.29.0`        | packages |
| `@typescript-eslint/rule-tester`       | `^8.29.0`        | packages |
| `@typescript-eslint/scope-manager`     | `^8.29.0`        | packages |
| `@typescript-eslint/typescript-estree` | `^8.29.0`        | packages |

### `update-21.2.0-typescript-eslint`

Update dependencies to version 21.2.0-typescript-eslint

**Version:** `21.2.0-typescript-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                | Version          | Type     |
| -------------------------------------- | ---------------- | -------- |
| `typescript-eslint`                    | `>8.0.0 <8.29.0` | requires |
| `typescript-eslint`                    | `^8.29.0`        | packages |
| `@typescript-eslint/eslint-plugin`     | `^8.29.0`        | packages |
| `@typescript-eslint/parser`            | `^8.29.0`        | packages |
| `@typescript-eslint/utils`             | `^8.29.0`        | packages |
| `@typescript-eslint/rule-tester`       | `^8.29.0`        | packages |
| `@typescript-eslint/scope-manager`     | `^8.29.0`        | packages |
| `@typescript-eslint/typescript-estree` | `^8.29.0`        | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/eslint@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/eslint@latest --dry-run
```
