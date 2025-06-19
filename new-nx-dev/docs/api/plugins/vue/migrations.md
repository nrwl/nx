---
title: '@nx/vue Migrations'
description: 'Complete reference for all @nx/vue migration commands'
sidebar_label: Migrations
---

# @nx/vue Migrations

The @nx/vue plugin provides various migrations to help you update your vue projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.4.3`

Update dependencies to version 19.4.3

**Version:** `19.4.3`

#### Package Updates

This migration updates the following packages:

| Package   | Version  | Type     |
| --------- | -------- | -------- |
| `vue-tsc` | `^2.0.0` | packages |

### `update-20.7.1`

Update dependencies to version 20.7.1

**Version:** `20.7.1`

#### Package Updates

This migration updates the following packages:

| Package              | Version   | Type     |
| -------------------- | --------- | -------- |
| `vue`                | `^3.5.13` | packages |
| `vue-tsc`            | `^2.2.8`  | packages |
| `vue-router`         | `^4.5.0`  | packages |
| `@vitejs/plugin-vue` | `^5.2.3`  | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/vue@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/vue@latest --dry-run
```
