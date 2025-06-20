---
title: '@nx/cypress Migrations'
description: 'Complete reference for all @nx/cypress migration commands'
sidebar_label: Migrations
---

# @nx/cypress Migrations

The @nx/cypress plugin provides various migrations to help you update your cypress projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.1.0`

Update dependencies to version 19.1.0

**Version:** `19.1.0`

#### Package Updates

This migration updates the following packages:

| Package                       | Version   | Type     |
| ----------------------------- | --------- | -------- |
| `cypress`                     | `^13.0.0` | requires |
| `cypress`                     | `^13.8.0` | packages |
| `@cypress/webpack-dev-server` | `^3.8.0`  | packages |

### `update-19.4.1`

Update dependencies to version 19.4.1

**Version:** `19.4.1`

#### Package Updates

This migration updates the following packages:

| Package   | Version    | Type     |
| --------- | ---------- | -------- |
| `cypress` | `^13.0.0`  | requires |
| `cypress` | `^13.13.0` | packages |

### `update-19-6-0-update-ci-webserver-for-vite`

Update ciWebServerCommand to use static serve for the application.

**Version:** `19.6.0-beta.4`

**Implementation:** `./src/migrations/update-19-6-0/update-ci-webserver-for-static-serve`

### `update-20.8.0`

Update dependencies to version 20.8.0

**Version:** `20.8.0`

#### Package Updates

This migration updates the following packages:

| Package                       | Version            | Type     |
| ----------------------------- | ------------------ | -------- |
| `cypress`                     | `>=13.0.0 <14.0.0` | requires |
| `cypress`                     | `^14.2.1`          | packages |
| `@cypress/vite-dev-server`    | `^6.0.3`           | packages |
| `@cypress/webpack-dev-server` | `^4.0.2`           | packages |

### `remove-experimental-fetch-polyfill`

Removes the `experimentalFetchPolyfill` configuration option.

**Version:** `20.8.0-beta.0`

**Implementation:** `./src/migrations/update-20-8-0/remove-experimental-fetch-polyfill`

#### Requirements

This migration requires the following:

- `cypress` >=14.0.0

### `replace-experimental-just-in-time-compile`

Replaces the `experimentalJustInTimeCompile` configuration option with the new `justInTimeCompile` configuration option.

**Version:** `20.8.0-beta.0`

**Implementation:** `./src/migrations/update-20-8-0/replace-experimental-just-in-time-compile`

#### Requirements

This migration requires the following:

- `cypress` >=14.0.0

### `set-inject-document-domain`

Replaces the `experimentalSkipDomainInjection` configuration option with the new `injectDocumentDomain` configuration option.

**Version:** `20.8.0-beta.0`

**Implementation:** `./src/migrations/update-20-8-0/set-inject-document-domain`

#### Requirements

This migration requires the following:

- `cypress` >=14.0.0

### `update-component-testing-mount-imports`

Updates the module specifier for the Component Testing `mount` function.

**Version:** `20.8.0-beta.0`

**Implementation:** `./src/migrations/update-20-8-0/update-component-testing-mount-imports`

#### Requirements

This migration requires the following:

- `cypress` >=14.0.0

### `remove-tsconfig-and-copy-files-options-from-cypress-executor`

Removes the `tsConfig` and `copyFiles` options from the `@nx/cypress:cypress` executor.

**Version:** `21.0.0-beta.10`

**Implementation:** `./src/migrations/update-21-0-0/remove-tsconfig-and-copy-files-options-from-cypress-executor`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/cypress@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/cypress@latest --dry-run
```
