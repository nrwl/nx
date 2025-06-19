---
title: '@nx/storybook Migrations'
description: 'Complete reference for all @nx/storybook migration commands'
sidebar_label: Migrations
---

# @nx/storybook Migrations

The @nx/storybook plugin provides various migrations to help you update your storybook projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.6.0`

Update dependencies to version 19.6.0

**Version:** `19.6.0`

#### Package Updates

This migration updates the following packages:

| Package                              | Version   | Type     |
| ------------------------------------ | --------- | -------- |
| `@storybook/core-server`             | `^8.2.8`  | packages |
| `@storybook/angular`                 | `^8.2.8`  | packages |
| `@storybook/react`                   | `^8.2.8`  | packages |
| `@storybook/addon-essentials`        | `^8.2.8`  | packages |
| `@storybook/addon-interactions`      | `^8.2.8`  | packages |
| `storybook`                          | `^8.2.8`  | packages |
| `@storybook/addon-controls`          | `^8.2.8`  | packages |
| `@storybook/addon-jest`              | `^8.2.8`  | packages |
| `@storybook/addon-mdx-gfm`           | `^8.2.8`  | packages |
| `@storybook/addon-onboarding`        | `^8.2.8`  | packages |
| `@storybook/addon-themes`            | `^8.2.8`  | packages |
| `@storybook/blocks`                  | `^8.2.8`  | packages |
| `@storybook/builder-manager`         | `^8.2.8`  | packages |
| `@storybook/builder-webpack5`        | `^8.2.8`  | packages |
| `@storybook/cli`                     | `^8.2.8`  | packages |
| `@storybook/components`              | `^8.2.8`  | packages |
| `@storybook/core`                    | `^8.2.8`  | packages |
| `@storybook/core-common`             | `^8.2.8`  | packages |
| `@storybook/core-events`             | `^8.2.8`  | packages |
| `@storybook/core-webpack`            | `^8.2.8`  | packages |
| `@storybook/csf-tools`               | `^8.2.8`  | packages |
| `@storybook/html`                    | `^8.2.8`  | packages |
| `@storybook/html-vite`               | `^8.2.8`  | packages |
| `@storybook/html-webpack5`           | `^8.2.8`  | packages |
| `@storybook/manager`                 | `^8.2.8`  | packages |
| `@storybook/manager-api`             | `^8.2.8`  | packages |
| `@storybook/nextjs`                  | `^8.2.8`  | packages |
| `@storybook/preact`                  | `^8.2.8`  | packages |
| `@storybook/preact-vite`             | `^8.2.8`  | packages |
| `@storybook/preact-webpack5`         | `^8.2.8`  | packages |
| `@storybook/preset-create-react-app` | `^8.2.8`  | packages |
| `@storybook/preset-html-webpack`     | `^8.2.8`  | packages |
| `@storybook/preset-preact-webpack`   | `^8.2.8`  | packages |
| `@storybook/preset-react-webpack`    | `^8.2.8`  | packages |
| `@storybook/preset-server-webpack`   | `^8.2.8`  | packages |
| `@storybook/preset-vue3-webpack`     | `^8.2.8`  | packages |
| `@storybook/react-vite`              | `^8.2.8`  | packages |
| `@storybook/react-webpack5`          | `^8.2.8`  | packages |
| `@storybook/router`                  | `^8.2.8`  | packages |
| `@storybook/server`                  | `^8.2.8`  | packages |
| `@storybook/server-webpack5`         | `^8.2.8`  | packages |
| `@storybook/svelte`                  | `^8.2.8`  | packages |
| `@storybook/svelte-vite`             | `^8.2.8`  | packages |
| `@storybook/sveltekit`               | `^8.2.8`  | packages |
| `@storybook/theming`                 | `^8.2.8`  | packages |
| `@storybook/types`                   | `^8.2.8`  | packages |
| `@storybook/vue3`                    | `^8.2.8`  | packages |
| `@storybook/vue3-vite`               | `^8.2.8`  | packages |
| `@storybook/vue3-webpack5`           | `^8.2.8`  | packages |
| `@storybook/web-components`          | `^8.2.8`  | packages |
| `@storybook/web-components-vite`     | `^8.2.8`  | packages |
| `@storybook/web-components-webpack5` | `^8.2.8`  | packages |
| `@storybook/test-runner`             | `^0.19.0` | packages |

### `update-19-6-0-add-nx-packages`

Update workspace to use Storybook v8

**Version:** `19.6.0-beta.0`

**Implementation:** `./src/migrations/update-19-6-0/update-sb-8`

### `update-20.2.0`

Update dependencies to version 20.2.0

**Version:** `20.2.0`

#### Package Updates

This migration updates the following packages:

| Package                              | Version   | Type     |
| ------------------------------------ | --------- | -------- |
| `@storybook/test-runner`             | `^0.19.0` | packages |
| `@storybook/core-server`             | `^8.4.6`  | packages |
| `@storybook/angular`                 | `^8.4.6`  | packages |
| `@storybook/react`                   | `^8.4.6`  | packages |
| `@storybook/react-vite`              | `^8.4.6`  | packages |
| `@storybook/react-webpack5`          | `^8.4.6`  | packages |
| `@storybook/web-components-vite`     | `^8.4.6`  | packages |
| `@storybook/web-components-webpack5` | `^8.4.6`  | packages |
| `@storybook/addon-a11y`              | `^8.4.6`  | packages |
| `@storybook/addon-actions`           | `^8.4.6`  | packages |
| `@storybook/addon-backgrounds`       | `^8.4.6`  | packages |
| `@storybook/addon-controls`          | `^8.4.6`  | packages |
| `@storybook/addon-docs`              | `^8.4.6`  | packages |
| `@storybook/addon-essentials`        | `^8.4.6`  | packages |
| `@storybook/addon-interactions`      | `^8.4.6`  | packages |
| `@storybook/addon-mdx-gfm`           | `^8.4.6`  | packages |
| `@storybook/addon-highlight`         | `^8.4.6`  | packages |
| `@storybook/addon-jest`              | `^8.4.6`  | packages |
| `@storybook/addon-links`             | `^8.4.6`  | packages |
| `@storybook/addon-measure`           | `^8.4.6`  | packages |
| `@storybook/addon-outline`           | `^8.4.6`  | packages |
| `@storybook/addon-storysource`       | `^8.4.6`  | packages |
| `@storybook/addon-toolbars`          | `^8.4.6`  | packages |
| `@storybook/addon-viewport`          | `^8.4.6`  | packages |
| `@storybook/vue3`                    | `^8.4.6`  | packages |
| `@storybook/vue3-vite`               | `^8.4.6`  | packages |
| `@storybook/addon-onboarding`        | `^8.4.6`  | packages |
| `@storybook/addon-themes`            | `^8.4.6`  | packages |
| `@storybook/blocks`                  | `^8.4.6`  | packages |
| `@storybook/builder-manager`         | `^8.4.6`  | packages |
| `@storybook/builder-webpack5`        | `^8.4.6`  | packages |
| `@storybook/cli`                     | `^8.4.6`  | packages |
| `@storybook/components`              | `^8.4.6`  | packages |
| `@storybook/core`                    | `^8.4.6`  | packages |
| `@storybook/core-common`             | `^8.4.6`  | packages |
| `@storybook/core-events`             | `^8.4.6`  | packages |
| `@storybook/core-webpack`            | `^8.4.6`  | packages |
| `@storybook/csf-tools`               | `^8.4.6`  | packages |
| `@storybook/html`                    | `^8.4.6`  | packages |
| `@storybook/html-vite`               | `^8.4.6`  | packages |
| `@storybook/html-webpack5`           | `^8.4.6`  | packages |
| `@storybook/manager`                 | `^8.4.6`  | packages |
| `@storybook/manager-api`             | `^8.4.6`  | packages |
| `@storybook/nextjs`                  | `^8.4.6`  | packages |
| `@storybook/preact`                  | `^8.4.6`  | packages |
| `@storybook/preact-vite`             | `^8.4.6`  | packages |
| `@storybook/preact-webpack5`         | `^8.4.6`  | packages |
| `@storybook/preset-create-react-app` | `^8.4.6`  | packages |
| `@storybook/preset-html-webpack`     | `^8.4.6`  | packages |
| `@storybook/preset-preact-webpack`   | `^8.4.6`  | packages |
| `@storybook/preset-react-webpack`    | `^8.4.6`  | packages |
| `@storybook/preset-server-webpack`   | `^8.4.6`  | packages |
| `@storybook/preset-vue3-webpack`     | `^8.4.6`  | packages |
| `@storybook/router`                  | `^8.4.6`  | packages |
| `@storybook/server`                  | `^8.4.6`  | packages |
| `@storybook/server-webpack5`         | `^8.4.6`  | packages |
| `@storybook/svelte`                  | `^8.4.6`  | packages |
| `@storybook/svelte-vite`             | `^8.4.6`  | packages |
| `@storybook/sveltekit`               | `^8.4.6`  | packages |
| `@storybook/theming`                 | `^8.4.6`  | packages |
| `@storybook/types`                   | `^8.4.6`  | packages |
| `@storybook/vue3-webpack5`           | `^8.4.6`  | packages |
| `@storybook/web-components`          | `^8.4.6`  | packages |

### `update-20.8.0`

Update dependencies to version 20.8.0

**Version:** `20.8.0`

#### Package Updates

This migration updates the following packages:

| Package                              | Version   | Type     |
| ------------------------------------ | --------- | -------- |
| `@storybook/test-runner`             | `^0.22.0` | packages |
| `@storybook/core-server`             | `^8.6.11` | packages |
| `@storybook/angular`                 | `^8.6.11` | packages |
| `@storybook/react`                   | `^8.6.11` | packages |
| `@storybook/react-vite`              | `^8.6.11` | packages |
| `@storybook/react-webpack5`          | `^8.6.11` | packages |
| `@storybook/web-components-vite`     | `^8.6.11` | packages |
| `@storybook/web-components-webpack5` | `^8.6.11` | packages |
| `@storybook/addon-a11y`              | `^8.6.11` | packages |
| `@storybook/addon-actions`           | `^8.6.11` | packages |
| `@storybook/addon-backgrounds`       | `^8.6.11` | packages |
| `@storybook/addon-controls`          | `^8.6.11` | packages |
| `@storybook/addon-docs`              | `^8.6.11` | packages |
| `@storybook/addon-essentials`        | `^8.6.11` | packages |
| `@storybook/addon-interactions`      | `^8.6.11` | packages |
| `@storybook/addon-mdx-gfm`           | `^8.6.11` | packages |
| `@storybook/addon-highlight`         | `^8.6.11` | packages |
| `@storybook/addon-jest`              | `^8.6.11` | packages |
| `@storybook/addon-links`             | `^8.6.11` | packages |
| `@storybook/addon-measure`           | `^8.6.11` | packages |
| `@storybook/addon-outline`           | `^8.6.11` | packages |
| `@storybook/addon-storysource`       | `^8.6.11` | packages |
| `@storybook/addon-toolbars`          | `^8.6.11` | packages |
| `@storybook/addon-viewport`          | `^8.6.11` | packages |
| `@storybook/vue3`                    | `^8.6.11` | packages |
| `@storybook/vue3-vite`               | `^8.6.11` | packages |
| `@storybook/addon-onboarding`        | `^8.6.11` | packages |
| `@storybook/addon-themes`            | `^8.6.11` | packages |
| `@storybook/blocks`                  | `^8.6.11` | packages |
| `@storybook/builder-manager`         | `^8.6.11` | packages |
| `@storybook/builder-webpack5`        | `^8.6.11` | packages |
| `@storybook/cli`                     | `^8.6.11` | packages |
| `@storybook/components`              | `^8.6.11` | packages |
| `@storybook/core`                    | `^8.6.11` | packages |
| `@storybook/core-common`             | `^8.6.11` | packages |
| `@storybook/core-events`             | `^8.6.11` | packages |
| `@storybook/core-webpack`            | `^8.6.11` | packages |
| `@storybook/csf-tools`               | `^8.6.11` | packages |
| `@storybook/html`                    | `^8.6.11` | packages |
| `@storybook/html-vite`               | `^8.6.11` | packages |
| `@storybook/html-webpack5`           | `^8.6.11` | packages |
| `@storybook/manager`                 | `^8.6.11` | packages |
| `@storybook/manager-api`             | `^8.6.11` | packages |
| `@storybook/nextjs`                  | `^8.6.11` | packages |
| `@storybook/preact`                  | `^8.6.11` | packages |
| `@storybook/preact-vite`             | `^8.6.11` | packages |
| `@storybook/preact-webpack5`         | `^8.6.11` | packages |
| `@storybook/preset-create-react-app` | `^8.6.11` | packages |
| `@storybook/preset-html-webpack`     | `^8.6.11` | packages |
| `@storybook/preset-preact-webpack`   | `^8.6.11` | packages |
| `@storybook/preset-react-webpack`    | `^8.6.11` | packages |
| `@storybook/preset-server-webpack`   | `^8.6.11` | packages |
| `@storybook/preset-vue3-webpack`     | `^8.6.11` | packages |
| `@storybook/router`                  | `^8.6.11` | packages |
| `@storybook/server`                  | `^8.6.11` | packages |
| `@storybook/server-webpack5`         | `^8.6.11` | packages |
| `@storybook/svelte`                  | `^8.6.11` | packages |
| `@storybook/svelte-vite`             | `^8.6.11` | packages |
| `@storybook/sveltekit`               | `^8.6.11` | packages |
| `@storybook/theming`                 | `^8.6.11` | packages |
| `@storybook/types`                   | `^8.6.11` | packages |
| `@storybook/vue3-webpack5`           | `^8.6.11` | packages |
| `@storybook/web-components`          | `^8.6.11` | packages |

### `update-21.1.0`

Update dependencies to version 21.1.0

**Version:** `21.1.0`

#### Package Updates

This migration updates the following packages:

| Package                          | Version  | Type     |
| -------------------------------- | -------- | -------- |
| `@storybook/angular`             | `^9.0.5` | packages |
| `@storybook/react`               | `^9.0.5` | packages |
| `storybook`                      | `^9.0.5` | packages |
| `@storybook/addon-onboarding`    | `^9.0.5` | packages |
| `@storybook/addon-themes`        | `^9.0.5` | packages |
| `@storybook/builder-webpack5`    | `^9.0.5` | packages |
| `@storybook/core-webpack`        | `^9.0.5` | packages |
| `@storybook/html`                | `^9.0.5` | packages |
| `@storybook/html-vite`           | `^9.0.5` | packages |
| `@storybook/nextjs`              | `^9.0.5` | packages |
| `@storybook/preact`              | `^9.0.5` | packages |
| `@storybook/preact-vite`         | `^9.0.5` | packages |
| `@storybook/react-vite`          | `^9.0.5` | packages |
| `@storybook/react-webpack5`      | `^9.0.5` | packages |
| `@storybook/server`              | `^9.0.5` | packages |
| `@storybook/server-webpack5`     | `^9.0.5` | packages |
| `@storybook/svelte`              | `^9.0.5` | packages |
| `@storybook/svelte-vite`         | `^9.0.5` | packages |
| `@storybook/sveltekit`           | `^9.0.5` | packages |
| `@storybook/vue3`                | `^9.0.5` | packages |
| `@storybook/vue3-vite`           | `^9.0.5` | packages |
| `@storybook/web-components`      | `^9.0.5` | packages |
| `@storybook/web-components-vite` | `^9.0.5` | packages |

### `update-21-2-0-migrate-storybook-v9`

Update workspace to use Storybook v9

**Version:** `21.2.0-beta.3`

**Implementation:** `./src/migrations/update-21-1-0/update-sb-9`

### `update-21-2-0-remove-addon-dependencies`

Remove deprecated Storybook addon dependencies

**Version:** `21.2.0-beta.3`

**Implementation:** `./src/migrations/update-21-2-0/remove-addon-dependencies`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/storybook@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/storybook@latest --dry-run
```
