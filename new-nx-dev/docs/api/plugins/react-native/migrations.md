---
title: '@nx/react-native Migrations'
description: 'Complete reference for all @nx/react-native migration commands'
sidebar_label: Migrations
---

# @nx/react-native Migrations

The @nx/react-native plugin provides various migrations to help you update your react-native projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-19.0.0`

Update dependencies to version 19.0.0

**Version:** `19.0.0`

#### Package Updates

This migration updates the following packages:

| Package                                        | Version    | Type     |
| ---------------------------------------------- | ---------- | -------- |
| `react-native`                                 | `0.73.6`   | packages |
| `@react-native-community/cli-platform-android` | `~12.3.6`  | packages |
| `@react-native/babel-preset`                   | `^0.73.21` | packages |
| `@react-native/metro-config`                   | `^0.73.5`  | packages |
| `react-native-web`                             | `^0.19.10` | packages |
| `@testing-library/react-native`                | `~12.4.5`  | packages |
| `react-native-svg-transformer`                 | `1.3.0`    | packages |
| `react-native-svg`                             | `15.1.0`   | packages |
| `@babel/runtime`                               | `7.24.4`   | packages |

### `update-19.2.0`

Update dependencies to version 19.2.0

**Version:** `19.2.0`

#### Package Updates

This migration updates the following packages:

| Package                                        | Version    | Type     |
| ---------------------------------------------- | ---------- | -------- |
| `react-native`                                 | `0.74.1`   | packages |
| `@react-native-community/cli-platform-android` | `~13.6.6`  | packages |
| `@react-native/babel-preset`                   | `^0.74.83` | packages |
| `@react-native/metro-config`                   | `^0.74.83` | packages |
| `react-native-web`                             | `^0.19.11` | packages |
| `@testing-library/react-native`                | `~12.5.0`  | packages |
| `react-native-svg`                             | `15.2.0`   | packages |
| `@babel/runtime`                               | `7.24.5`   | packages |

### `update-19.5.0`

Update dependencies to version 19.5.0

**Version:** `19.5.0`

#### Package Updates

This migration updates the following packages:

| Package            | Version  | Type     |
| ------------------ | -------- | -------- |
| `react-native-svg` | `15.3.0` | packages |

### `update-19-6-0-rename-upgrade-target-name`

Rename upgrade target name to fix casing.

**Version:** `19.6.0-beta.1`

**Implementation:** `./src/migrations/update-19-6-0/rename-upgrade-target-name`

### `update-20.3.0`

Update dependencies to version 20.3.0

**Version:** `20.3.0`

#### Package Updates

This migration updates the following packages:

| Package                                        | Version    | Type     |
| ---------------------------------------------- | ---------- | -------- |
| `react-native`                                 | `~0.76.3`  | packages |
| `@react-native-community/cli`                  | `~15.0.1`  | packages |
| `@react-native-community/cli-platform-android` | `~15.0.1`  | packages |
| `@react-native-community/cli-platform-ios`     | `~15.0.1`  | packages |
| `@react-native/babel-preset`                   | `~0.76.3`  | packages |
| `@react-native/metro-config`                   | `~0.76.3`  | packages |
| `react-native-web`                             | `~0.19.13` | packages |
| `react`                                        | `~18.3.1`  | packages |
| `react-dom`                                    | `~18.3.1`  | packages |
| `react-test-renderer`                          | `~18.3.1`  | packages |
| `@types/react`                                 | `~18.3.12` | packages |
| `@types/react-dom`                             | `~18.3.1`  | packages |
| `@testing-library/react-native`                | `~12.9.0`  | packages |
| `react-native-svg-transformer`                 | `~1.5.0`   | packages |
| `react-native-svg`                             | `~15.8.0`  | packages |
| `react-native-svg-web`                         | `~1.0.9`   | packages |
| `@babel/runtime`                               | `~7.26.0`  | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/react-native@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/react-native@latest --dry-run
```
