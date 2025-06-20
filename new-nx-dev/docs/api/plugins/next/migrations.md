---
title: '@nx/next Migrations'
description: 'Complete reference for all @nx/next migration commands'
sidebar_label: Migrations
---

# @nx/next Migrations

The @nx/next plugin provides various migrations to help you update your next projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.0.3`

Update dependencies to version 19.0.3

**Version:** `19.0.3`

#### Package Updates

This migration updates the following packages:

| Package              | Version  | Type     |
| -------------------- | -------- | -------- |
| `next`               | `14.2.3` | packages |
| `eslint-config-next` | `14.2.3` | packages |

### `update-20.7.1-beta.0`

Update dependencies to version 20.7.1-beta.0

**Version:** `20.7.1-beta.0`

#### Package Updates

This migration updates the following packages:

| Package              | Version   | Type     |
| -------------------- | --------- | -------- |
| `eslint-config-next` | `^15.2.4` | packages |

### `update-20.7.1-beta.0-next14`

Update dependencies to version 20.7.1-beta.0-next14

**Version:** `20.7.1-beta.0-next14`

#### Package Updates

This migration updates the following packages:

| Package | Version    | Type     |
| ------- | ---------- | -------- |
| `next`  | `^14.0.0`  | requires |
| `next`  | `~14.2.26` | packages |

### `update-20.7.1-beta.0-next15`

Update dependencies to version 20.7.1-beta.0-next15

**Version:** `20.7.1-beta.0-next15`

#### Package Updates

This migration updates the following packages:

| Package | Version   | Type     |
| ------- | --------- | -------- |
| `next`  | `^15.0.0` | requires |
| `next`  | `~15.2.4` | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/next@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/next@latest --dry-run
```
