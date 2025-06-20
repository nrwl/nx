---
title: '@nx/playwright Migrations'
description: 'Complete reference for all @nx/playwright migration commands'
sidebar_label: Migrations
---

# @nx/playwright Migrations

The @nx/playwright plugin provides various migrations to help you update your playwright projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `19-6-0-use-serve-static-preview-for-command`

Use serve-static or preview for webServerCommand.

**Version:** `19.6.0-beta.0`

**Implementation:** `./src/migrations/update-19-6-0/use-serve-static-preview-for-command`

### `update-19-6-0-add-e2e-ci-target-defaults`

Add inferred ciTargetNames to targetDefaults with dependsOn to ensure dependent application builds are scheduled before atomized tasks.

**Version:** `19.6.0-beta.1`

**Implementation:** `./src/migrations/update-19-6-0/add-e2e-ci-target-defaults`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/playwright@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/playwright@latest --dry-run
```
