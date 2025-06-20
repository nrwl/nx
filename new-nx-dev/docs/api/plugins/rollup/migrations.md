---
title: '@nx/rollup Migrations'
description: 'Complete reference for all @nx/rollup migration commands'
sidebar_label: Migrations
---

# @nx/rollup Migrations

The @nx/rollup plugin provides various migrations to help you update your rollup projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.0.0`

Update dependencies to version 19.0.0

**Version:** `19.0.0`

#### Package Updates

This migration updates the following packages:

| Package              | Version  | Type     |
| -------------------- | -------- | -------- |
| `@rollup/plugin-url` | `^8.0.2` | packages |
| `@svgr/rollup`       | `^8.1.0` | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/rollup@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/rollup@latest --dry-run
```
