---
title: '@nx/react Migrations'
description: 'Complete reference for all @nx/react migration commands'
sidebar_label: Migrations
---

# @nx/react Migrations

The @nx/react plugin provides various migrations to help you update your react projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.0.0`

Update dependencies to version 19.0.0

**Version:** `19.0.0`

#### Package Updates

This migration updates the following packages:

| Package                  | Version  | Type     |
| ------------------------ | -------- | -------- |
| `react`                  | `18.3.1` | packages |
| `react-dom`              | `18.3.1` | packages |
| `react-is`               | `18.3.1` | packages |
| `@types/react`           | `18.3.1` | packages |
| `@types/react-dom`       | `18.3.0` | packages |
| `@types/react-is`        | `18.3.0` | packages |
| `@testing-library/react` | `15.0.6` | packages |

### `update-19.0.3`

Update dependencies to version 19.0.3

**Version:** `19.0.3`

#### Package Updates

This migration updates the following packages:

| Package       | Version | Type     |
| ------------- | ------- | -------- |
| `tailwindcss` | `3.4.3` | packages |

### `update-19.2.0`

Update dependencies to version 19.2.0

**Version:** `19.2.0`

#### Package Updates

This migration updates the following packages:

| Package   | Version  | Type     |
| --------- | -------- | -------- |
| `postcss` | `8.4.38` | packages |

### `update-19.5.0-module-federation`

Update dependencies to version 19.5.0-module-federation

**Version:** `19.5.0-module-federation`

#### Package Updates

This migration updates the following packages:

| Package                   | Version  | Type     |
| ------------------------- | -------- | -------- |
| `@module-federation/node` | `^2.3.0` | packages |

### `update-19-6-0-turn-module-federation-dts-off`

Ensure Module Federation DTS is turned off by default.

**Version:** `19.6.0-beta.4`

**Implementation:** `./src/migrations/update-19-6-0/turn-off-dts-by-default`

### `update-module-federation-ssr-server-file`

Update the server file for Module Federation SSR port value to be the same as the 'serve' target port value.

**Version:** `19.6.0-beta.4`

**Implementation:** `./src/migrations/update-19-6-0/update-ssr-server-port`

### `update-19-6-1-ensure-module-federation-target-defaults`

Ensure Target Defaults are set correctly for Module Federation.

**Version:** `19.6.1-beta.0`

**Implementation:** `./src/migrations/update-19-6-1/ensure-depends-on-for-mf`

### `update-19.7.0`

Update dependencies to version 19.7.0

**Version:** `19.7.0`

#### Package Updates

This migration updates the following packages:

| Package                       | Version  | Type     |
| ----------------------------- | -------- | -------- |
| `@module-federation/enhanced` | `~0.6.0` | packages |
| `@module-federation/node`     | `~2.5.0` | packages |

### `update-20.0.0`

Update dependencies to version 20.0.0

**Version:** `20.0.0`

#### Package Updates

This migration updates the following packages:

| Package                | Version  | Type     |
| ---------------------- | -------- | -------- |
| `eslint-plugin-import` | `2.31.0` | packages |

### `update-20.1.0`

Update dependencies to version 20.1.0

**Version:** `20.1.0`

#### Package Updates

This migration updates the following packages:

| Package                     | Version  | Type     |
| --------------------------- | -------- | -------- |
| `eslint-plugin-react-hooks` | `5.0.0`  | packages |
| `eslint-plugin-jsx-a11y`    | `6.10.1` | packages |

### `update-20.2.0`

Update dependencies to version 20.2.0

**Version:** `20.2.0`

#### Package Updates

This migration updates the following packages:

| Package                       | Version  | Type     |
| ----------------------------- | -------- | -------- |
| `@module-federation/enhanced` | `0.7.6`  | packages |
| `@module-federation/runtime`  | `0.7.6`  | packages |
| `@module-federation/sdk`      | `0.7.6`  | packages |
| `@module-federation/node`     | `2.6.11` | packages |

### `update-20-2-0-update-module-federation-config-import`

Update the ModuleFederationConfig import use @nx/module-federation.

**Version:** `20.2.0-beta.2`

**Implementation:** `./src/migrations/update-20-2-0/migrate-mf-imports-to-new-package`

### `update-20-2-0-update-with-module-federation-import`

Update the withModuleFederation import use @nx/module-federation/webpack.

**Version:** `20.2.0-beta.2`

**Implementation:** `./src/migrations/update-20-2-0/migrate-with-mf-import-to-new-package`

### `update-20.3.0`

Update dependencies to version 20.3.0

**Version:** `20.3.0`

#### Package Updates

This migration updates the following packages:

| Package                  | Version  | Type     |
| ------------------------ | -------- | -------- |
| `@testing-library/react` | `16.1.0` | packages |

### `ensure-nx-module-federation-package`

If workspace includes Module Federation projects, ensure the new @nx/module-federation package is installed.

**Version:** `20.3.0-beta.2`

**Implementation:** `./src/migrations/update-20-3-0/ensure-nx-module-federation-package`

### `add-mf-env-var-to-target-defaults`

Add NX_MF_DEV_REMOTES to inputs for task hashing when '@nx/webpack:webpack' or '@nx/rspack:rspack' is used for Module Federation.

**Version:** `20.4.0-beta.0`

**Implementation:** `./src/migrations/update-18-0-0/add-mf-env-var-to-target-defaults`

### `update-21-0-0-update-babel-loose`

Replaces `classProperties.loose` option with `loose`.

**Version:** `21.0.0-beta.11`

**Implementation:** `./src/migrations/update-21-0-0/update-babel-loose`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/react@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/react@latest --dry-run
```
