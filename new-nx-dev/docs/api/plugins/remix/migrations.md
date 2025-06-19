---
title: '@nx/remix Migrations'
description: 'Complete reference for all @nx/remix migration commands'
sidebar_label: Migrations
---

# @nx/remix Migrations

The @nx/remix plugin provides various migrations to help you update your remix projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-20.1.0`

Update dependencies to version 20.1.0

**Version:** `20.1.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version   | Type     |
| ------------------------------- | --------- | -------- |
| `@remix-run/node`               | `^2.14.0` | packages |
| `@remix-run/react`              | `^2.14.0` | packages |
| `@remix-run/serve`              | `^2.14.0` | packages |
| `@remix-run/dev`                | `^2.14.0` | packages |
| `@remix-run/css-bundle`         | `^2.14.0` | packages |
| `@remix-run/eslint-config`      | `^2.14.0` | packages |
| `@remix-run/server-runtime`     | `^2.14.0` | packages |
| `@remix-run/testing`            | `^2.14.0` | packages |
| `@remix-run/express`            | `^2.14.0` | packages |
| `@remix-run/cloudflare`         | `^2.14.0` | packages |
| `@remix-run/cloudflare-pages`   | `^2.14.0` | packages |
| `@remix-run/cloudflare-workers` | `^2.14.0` | packages |
| `@remix-run/architect`          | `^2.14.0` | packages |
| `@remix-run/deno`               | `^2.14.0` | packages |
| `@remix-run/route-config`       | `^2.14.0` | packages |
| `@remix-run/fs-routes`          | `^2.14.0` | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/remix@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/remix@latest --dry-run
```
