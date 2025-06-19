---
title: '@nx/workspace Migrations'
description: 'Complete reference for all @nx/workspace migration commands'
sidebar_label: Migrations
---

# @nx/workspace Migrations

The @nx/workspace plugin provides various migrations to help you update your workspace projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.5.1`

Update dependencies to version 19.5.1

**Version:** `19.5.1`

#### Package Updates

This migration updates the following packages:

| Package      | Version          | Type     |
| ------------ | ---------------- | -------- |
| `typescript` | `>=5.4.0 <5.5.0` | requires |
| `typescript` | `~5.5.2`         | packages |

### `update-20.2.0`

Update dependencies to version 20.2.0

**Version:** `20.2.0`

#### Package Updates

This migration updates the following packages:

| Package      | Version          | Type     |
| ------------ | ---------------- | -------- |
| `typescript` | `>=5.5.0 <5.6.0` | requires |
| `typescript` | `~5.6.2`         | packages |

### `update-20.4.0`

Update dependencies to version 20.4.0

**Version:** `20.4.0`

#### Package Updates

This migration updates the following packages:

| Package      | Version          | Type     |
| ------------ | ---------------- | -------- |
| `typescript` | `>=5.6.0 <5.7.0` | requires |
| `typescript` | `~5.7.2`         | packages |

### `update-21.2.0`

Update dependencies to version 21.2.0

**Version:** `21.2.0`

#### Package Updates

This migration updates the following packages:

| Package      | Version          | Type     |
| ------------ | ---------------- | -------- |
| `typescript` | `>=5.7.0 <5.8.0` | requires |
| `typescript` | `~5.8.2`         | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/workspace@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/workspace@latest --dry-run
```
