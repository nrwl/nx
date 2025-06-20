---
title: '@nx/webpack Migrations'
description: 'Complete reference for all @nx/webpack migration commands'
sidebar_label: Migrations
---

# @nx/webpack Migrations

The @nx/webpack plugin provides various migrations to help you update your webpack projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.6.0`

Update dependencies to version 19.6.0

**Version:** `19.6.0`

#### Package Updates

This migration updates the following packages:

| Package              | Version  | Type     |
| -------------------- | -------- | -------- |
| `webpack-dev-server` | `^5.0.4` | packages |

### `update-19-6-3-proxy-config`

Migrate proxy config files to match new format from webpack-dev-server v5.

**Version:** `19.6.3-beta.0`

**Implementation:** `./src/migrations/update-19-6-3/proxy-config`

### `update-19.7.0`

Update dependencies to version 19.7.0

**Version:** `19.7.0`

#### Package Updates

This migration updates the following packages:

| Package                       | Version  | Type     |
| ----------------------------- | -------- | -------- |
| `@module-federation/enhanced` | `~0.6.0` | packages |
| `@module-federation/sdk`      | `~0.6.0` | packages |

### `update-20.5.0`

Update dependencies to version 20.5.0

**Version:** `20.5.0`

#### Package Updates

This migration updates the following packages:

| Package       | Version   | Type     |
| ------------- | --------- | -------- |
| `sass-loader` | `^16.0.4` | packages |

### `update-20.7.1`

Update dependencies to version 20.7.1

**Version:** `20.7.1`

#### Package Updates

This migration updates the following packages:

| Package              | Version  | Type     |
| -------------------- | -------- | -------- |
| `webpack`            | `5.98.0` | packages |
| `webpack-dev-server` | `^5.2.1` | packages |

### `update-21-0-0-remove-isolated-config`

Remove isolatedConfig option for @nx/webpack:webpack

**Version:** `21.0.0-beta.11`

**Implementation:** `./src/migrations/update-21-0-0/remove-isolated-config`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/webpack@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/webpack@latest --dry-run
```
