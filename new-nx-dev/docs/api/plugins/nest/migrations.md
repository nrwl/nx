---
title: '@nx/nest Migrations'
description: 'Complete reference for all @nx/nest migration commands'
sidebar_label: Migrations
---

# @nx/nest Migrations

The @nx/nest plugin provides various migrations to help you update your nest projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-21.2.0-beta.2`

Update dependencies to version 21.2.0-beta.2

**Version:** `21.2.0-beta.2`

#### Package Updates

This migration updates the following packages:

| Package              | Version   | Type     |
| -------------------- | --------- | -------- |
| `nest`               | `^11.0.0` | packages |
| `@nestjs/schematics` | `^11.0.0` | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/nest@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/nest@latest --dry-run
```
