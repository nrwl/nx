---
title: '@nx/detox Migrations'
description: 'Complete reference for all @nx/detox migration commands'
sidebar_label: Migrations
---

# @nx/detox Migrations

The @nx/detox plugin provides various migrations to help you update your detox projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.2.0`

Update dependencies to version 19.2.0

**Version:** `19.2.0`

#### Package Updates

This migration updates the following packages:

| Package                 | Version  | Type     |
| ----------------------- | -------- | -------- |
| `@config-plugins/detox` | `~8.0.0` | packages |

### `update-20.3.0`

Update dependencies to version 20.3.0

**Version:** `20.3.0`

#### Package Updates

This migration updates the following packages:

| Package                     | Version    | Type     |
| --------------------------- | ---------- | -------- |
| `detox`                     | `~20.28.0` | packages |
| `@testing-library/jest-dom` | `~6.6.3`   | packages |

### `update-20.4.0`

Update dependencies to version 20.4.0

**Version:** `20.4.0`

#### Package Updates

This migration updates the following packages:

| Package                 | Version    | Type     |
| ----------------------- | ---------- | -------- |
| `detox`                 | `~20.31.0` | packages |
| `@config-plugins/detox` | `~9.0.0`   | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/detox@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/detox@latest --dry-run
```
