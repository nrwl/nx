---
title: '@nx/jest Migrations'
description: 'Complete reference for all @nx/jest migration commands'
sidebar_label: Migrations
---

# @nx/jest Migrations

The @nx/jest plugin provides various migrations to help you update your jest projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.2.0`

Update dependencies to version 19.2.0

**Version:** `19.2.0`

#### Package Updates

This migration updates the following packages:

| Package     | Version   | Type     |
| ----------- | --------- | -------- |
| `@swc/jest` | `~0.2.36` | packages |

### `update-19.6.0`

Update dependencies to version 19.6.0

**Version:** `19.6.0`

#### Package Updates

This migration updates the following packages:

| Package                  | Version    | Type     |
| ------------------------ | ---------- | -------- |
| `jest`                   | `~29.7.0`  | packages |
| `@types/jest`            | `~29.5.12` | packages |
| `expect`                 | `~29.7.0`  | packages |
| `@jest/globals`          | `~29.7.0`  | packages |
| `jest-jasmine2`          | `~29.7.0`  | packages |
| `jest-environment-jsdom` | `~29.7.0`  | packages |
| `babel-jest`             | `~29.7.0`  | packages |

### `replace-getJestProjects-with-getJestProjectsAsync`

Replace usage of `getJestProjects` with `getJestProjectsAsync`.

**Version:** `20.0.0-beta.5`

**Implementation:** `./src/migrations/update-20-0-0/replace-getJestProjects-with-getJestProjectsAsync`

### `replace-getJestProjects-with-getJestProjectsAsync-v21`

Replace usage of `getJestProjects` with `getJestProjectsAsync`.

**Version:** `21.0.0-beta.9`

**Implementation:** `./src/migrations/update-21-0-0/replace-getJestProjects-with-getJestProjectsAsync`

### `remove-tsconfig-option-from-jest-executor`

Remove the previously deprecated and unused `tsConfig` option from the `@nx/jest:jest` executor.

**Version:** `21.0.0-beta.10`

**Implementation:** `./src/migrations/update-21-0-0/remove-tsconfig-option-from-jest-executor`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/jest@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/jest@latest --dry-run
```
