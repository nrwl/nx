---
title: '@nx/node Migrations'
description: 'Complete reference for all @nx/node migration commands'
sidebar_label: Migrations
---

# @nx/node Migrations

The @nx/node plugin provides various migrations to help you update your node projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-20.4.0`

Update dependencies to version 20.4.0

**Version:** `20.4.0`

#### Package Updates

This migration updates the following packages:

| Package             | Version    | Type     |
| ------------------- | ---------- | -------- |
| `fastify`           | `~5.2.1`   | packages |
| `fastify-plugin`    | `~5.0.1`   | packages |
| `@fastify/autoload` | `~6.0.3`   | packages |
| `@fastify/sensible` | `~6.0.2`   | packages |
| `express`           | `^4.21.2`  | packages |
| `@types/express`    | `^4.17.21` | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/node@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/node@latest --dry-run
```
