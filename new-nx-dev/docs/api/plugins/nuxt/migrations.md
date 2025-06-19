---
title: '@nx/nuxt Migrations'
description: 'Complete reference for all @nx/nuxt migration commands'
sidebar_label: Migrations
---

# @nx/nuxt Migrations

The @nx/nuxt plugin provides various migrations to help you update your nuxt projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `add-vue-to-storybook-config`

Add vue() plugin to viteFinal in Storybook config files when it is missing.

**Version:** `19.6.0-beta.0`

**Implementation:** `./src/migrations/update-19-6-0/add-vue-plugin-to-storybook-config`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/nuxt@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/nuxt@latest --dry-run
```
