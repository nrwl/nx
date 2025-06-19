---
title: '@nx/expo Migrations'
description: 'Complete reference for all @nx/expo migration commands'
sidebar_label: Migrations
---

# @nx/expo Migrations

The @nx/expo plugin provides various migrations to help you update your expo projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.0.0`

Update dependencies to version 19.0.0

**Version:** `19.0.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version    | Type     |
| ------------------------------- | ---------- | -------- |
| `expo`                          | `~50.0.14` | packages |
| `expo-splash-screen`            | `~0.26.4`  | packages |
| `@expo/cli`                     | `~0.17.8`  | packages |
| `babel-preset-expo`             | `~10.0.1`  | packages |
| `react-native`                  | `~0.73.6`  | packages |
| `react-native-web`              | `~0.19.10` | packages |
| `@expo/metro-config`            | `~0.17.6`  | packages |
| `@expo/metro-runtime`           | `~3.1.3`   | packages |
| `react-native-svg-transformer`  | `1.3.0`    | packages |
| `react-native-svg`              | `15.1.0`   | packages |
| `@testing-library/react-native` | `~12.4.5`  | packages |
| `jest-expo`                     | `~50.0.4`  | packages |

### `update-19-0-0-change-webpack-to-metro`

Change webpack to metro in expo projects

**Version:** `19.0.0-beta.9`

**Implementation:** `./src/migrations/update-19-0-0/change-webpack-to-metro`

### `update-19.2.0`

Update dependencies to version 19.2.0

**Version:** `19.2.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version    | Type     |
| ------------------------------- | ---------- | -------- |
| `expo`                          | `~51.0.8`  | packages |
| `expo-splash-screen`            | `~0.27.4`  | packages |
| `expo-status-bar`               | `~1.12.1`  | packages |
| `@expo/cli`                     | `~0.18.13` | packages |
| `babel-preset-expo`             | `~11.0.0`  | packages |
| `react-native`                  | `0.74.1`   | packages |
| `react-native-web`              | `~0.19.11` | packages |
| `@expo/metro-config`            | `~0.18.1`  | packages |
| `@expo/metro-runtime`           | `~3.2.1`   | packages |
| `react-native-svg-transformer`  | `1.3.0`    | packages |
| `react-native-svg`              | `15.2.0`   | packages |
| `@testing-library/react-native` | `~12.5.0`  | packages |
| `jest-expo`                     | `~51.0.2`  | packages |
| `@babel/runtime`                | `7.24.5`   | packages |

### `update-19-2-0-remove-webpack-config`

Remove deprecated webpack.config.js

**Version:** `19.2.0-beta.2`

**Implementation:** `./src/migrations/update-19-2-0/remove-deprecated-webpack-config`

### `update-19-7-0-remove-eas-pre-install`

Remove eas-build-pre-install script from app's package.json

**Version:** `19.7.0-beta.4`

**Implementation:** `./src/migrations/update-19-7-0/remove-eas-pre-install`

### `update-20.3.0`

Update dependencies to version 20.3.0

**Version:** `20.3.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version    | Type     |
| ------------------------------- | ---------- | -------- |
| `expo`                          | `~52.0.11` | packages |
| `expo-splash-screen`            | `~0.29.13` | packages |
| `expo-status-bar`               | `~2.0.0`   | packages |
| `@expo/cli`                     | `~0.21.8`  | packages |
| `babel-preset-expo`             | `~12.0.1`  | packages |
| `react`                         | `~18.3.1`  | packages |
| `react-dom`                     | `~18.3.1`  | packages |
| `react-test-renderer`           | `~18.3.1`  | packages |
| `@types/react`                  | `~18.3.12` | packages |
| `react-native`                  | `~0.76.3`  | packages |
| `react-native-web`              | `~0.19.13` | packages |
| `@expo/metro-config`            | `~0.19.4`  | packages |
| `@expo/metro-runtime`           | `~4.0.0`   | packages |
| `react-native-svg-transformer`  | `~1.5.0`   | packages |
| `react-native-svg`              | `~15.8.0`  | packages |
| `@testing-library/react-native` | `~12.9.0`  | packages |
| `jest-expo`                     | `~52.0.2`  | packages |
| `@babel/runtime`                | `7.26.0`   | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/expo@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/expo@latest --dry-run
```
