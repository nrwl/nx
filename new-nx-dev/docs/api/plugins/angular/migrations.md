---
title: '@nx/angular Migrations'
description: 'Complete reference for all @nx/angular migration commands'
sidebar_label: Migrations
---

# @nx/angular Migrations

The @nx/angular plugin provides various migrations to help you update your angular projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `update-16.1.0`

Update dependencies to version 16.1.0

**Version:** `16.1.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=15.2.0 <16.0.0` | requires |
| `@angular/core`                 | `~16.0.0`          | packages |
| `zone.js`                       | `~0.13.0`          | packages |
| `@angular-devkit/architect`     | `~0.1600.0`        | packages |
| `@angular-devkit/build-angular` | `~16.0.0`          | packages |
| `@angular-devkit/build-webpack` | `~0.1600.0`        | packages |
| `@angular-devkit/core`          | `~16.0.0`          | packages |
| `@angular-devkit/schematics`    | `~16.0.0`          | packages |
| `@angular/pwa`                  | `~16.0.0`          | packages |
| `@schematics/angular`           | `~16.0.0`          | packages |
| `ng-packagr`                    | `~16.0.0`          | packages |
| `@nguniversal/build-angular`    | `~16.0.0`          | packages |
| `@nguniversal/builders`         | `~16.0.0`          | packages |
| `@nguniversal/common`           | `~16.0.0`          | packages |
| `@nguniversal/express-engine`   | `~16.0.0`          | packages |
| `@angular/material`             | `~16.0.0`          | packages |
| `@angular/cdk`                  | `~16.0.0`          | packages |

### `update-16.1.0-angular-eslint`

Update dependencies to version 16.1.0-angular-eslint

**Version:** `16.1.0-angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                  | Version            | Type     |
| ---------------------------------------- | ------------------ | -------- | ------- | -------- |
| `eslint`                                 | `^7.20.0           |          | ^8.0.0` | requires |
| `@angular/core`                          | `>=16.0.0 <17.0.0` | requires |
| `@angular-eslint/eslint-plugin`          | `~16.0.0`          | packages |
| `@angular-eslint/eslint-plugin-template` | `~16.0.0`          | packages |
| `@angular-eslint/template-parser`        | `~16.0.0`          | packages |

### `update-16.1.3-jest`

Update dependencies to version 16.1.3-jest

**Version:** `16.1.3-jest`

#### Package Updates

This migration updates the following packages:

| Package                             | Version            | Type     |
| ----------------------------------- | ------------------ | -------- |
| `@angular-devkit/build-angular`     | `>=13.0.0 <17.0.0` | requires |
| `@angular/compiler-cli`             | `>=13.0.0 <17.0.0` | requires |
| `@angular/core`                     | `>=13.0.0 <17.0.0` | requires |
| `@angular/platform-browser-dynamic` | `>=13.0.0 <17.0.0` | requires |
| `jest`                              | `^29.0.0`          | requires |
| `jest-preset-angular`               | `~13.1.0`          | packages |

### `switch-data-persistence-operators-imports-to-ngrx-router-store`

Switch the data persistence operator imports to '@ngrx/router-store/data-persistence'.

**Version:** `16.2.0-beta.0`

**Implementation:** `./src/migrations/update-16-2-0/switch-data-persistence-operators-imports-to-ngrx-router-store`

#### Requirements

This migration requires the following:

- `@ngrx/store` >=16.0.0

### `update-16.2.0-ngrx`

Update dependencies to version 16.2.0-ngrx

**Version:** `16.2.0-ngrx`

#### Package Updates

This migration updates the following packages:

| Package         | Version   | Type     |
| --------------- | --------- | -------- |
| `@angular/core` | `^16.0.0` | requires |
| `@ngrx/store`   | `~16.0.0` | packages |

### `update-16.4.0`

Update dependencies to version 16.4.0

**Version:** `16.4.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=16.0.0 <16.1.0` | requires |
| `@angular-devkit/architect`     | `~0.1601.0`        | packages |
| `@angular-devkit/build-angular` | `~16.1.0`          | packages |
| `@angular-devkit/build-webpack` | `~0.1601.0`        | packages |
| `@angular-devkit/core`          | `~16.1.0`          | packages |
| `@angular-devkit/schematics`    | `~16.1.0`          | packages |
| `@angular/pwa`                  | `~16.1.0`          | packages |
| `@angular/core`                 | `~16.1.0`          | packages |
| `@angular/material`             | `~16.1.0`          | packages |
| `@angular/cdk`                  | `~16.1.0`          | packages |
| `@nguniversal/builders`         | `~16.1.0`          | packages |
| `@nguniversal/common`           | `~16.1.0`          | packages |
| `@nguniversal/express-engine`   | `~16.1.0`          | packages |
| `@schematics/angular`           | `~16.1.0`          | packages |
| `ng-packagr`                    | `~16.1.0`          | packages |

### `rename-angular-eslint-accesibility-rules`

Remove the 'accessibility-' prefix from '@angular-eslint/eslint-plugin-template' rules.

**Version:** `16.4.0-beta.6`

**Implementation:** `./src/migrations/update-16-4-0/rename-angular-eslint-accesibility-rules`

#### Requirements

This migration requires the following:

- `@angular-eslint/eslint-plugin-template` >=16.0.0

### `update-angular-cli-version-16-1-0`

Update the @angular/cli package version to ~16.1.0.

**Version:** `16.4.0-beta.11`

**Implementation:** `./src/migrations/update-16-4-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=16.1.0

### `explicitly-set-projects-to-update-buildable-deps`

Explicitly set 'updateBuildableProjectDepsInPackageJson' to 'true' in targets that rely on that value as the default.

**Version:** `16.6.0-beta.0`

**Implementation:** `./src/migrations/update-16-6-0/explicitly-set-projects-to-update-buildable-deps`

### `update-16.7.0`

Update dependencies to version 16.7.0

**Version:** `16.7.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=16.1.0 <16.2.0` | requires |
| `@angular-devkit/architect`     | `~0.1602.0`        | packages |
| `@angular-devkit/build-angular` | `~16.2.0`          | packages |
| `@angular-devkit/build-webpack` | `~0.1602.0`        | packages |
| `@angular-devkit/core`          | `~16.2.0`          | packages |
| `@angular-devkit/schematics`    | `~16.2.0`          | packages |
| `@angular/pwa`                  | `~16.2.0`          | packages |
| `@angular/core`                 | `~16.2.0`          | packages |
| `@angular/material`             | `~16.2.0`          | packages |
| `@angular/cdk`                  | `~16.2.0`          | packages |
| `@nguniversal/builders`         | `~16.2.0`          | packages |
| `@nguniversal/common`           | `~16.2.0`          | packages |
| `@nguniversal/express-engine`   | `~16.2.0`          | packages |
| `@schematics/angular`           | `~16.2.0`          | packages |
| `ng-packagr`                    | `~16.2.0`          | packages |

### `update-angular-cli-version-16-2-0`

Update the @angular/cli package version to ~16.2.0.

**Version:** `16.7.0-beta.6`

**Implementation:** `./src/migrations/update-16-7-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=16.2.0

### `update-16.8.0`

Update dependencies to version 16.8.0

**Version:** `16.8.0`

#### Package Updates

This migration updates the following packages:

| Package   | Version   | Type     |
| --------- | --------- | -------- |
| `esbuild` | `^0.19.2` | packages |

### `update-17.1.0`

Update dependencies to version 17.1.0

**Version:** `17.1.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=16.2.0 <17.0.0` | requires |
| `@angular-devkit/architect`     | `~0.1700.0`        | packages |
| `@angular-devkit/build-angular` | `~17.0.0`          | packages |
| `@angular-devkit/build-webpack` | `~0.1700.0`        | packages |
| `@angular-devkit/core`          | `~17.0.0`          | packages |
| `@angular-devkit/schematics`    | `~17.0.0`          | packages |
| `@angular/pwa`                  | `~17.0.0`          | packages |
| `@angular/core`                 | `~17.0.0`          | packages |
| `@angular/material`             | `~17.0.0`          | packages |
| `@angular/cdk`                  | `~17.0.0`          | packages |
| `@schematics/angular`           | `~17.0.0`          | packages |
| `ng-packagr`                    | `~17.0.0`          | packages |
| `zone.js`                       | `~0.14.0`          | packages |

### `update-17.1.0-angular-eslint`

Update dependencies to version 17.1.0-angular-eslint

**Version:** `17.1.0-angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                  | Version              | Type     |
| ---------------------------------------- | -------------------- | -------- | ------- | -------- |
| `eslint`                                 | `^7.20.0             |          | ^8.0.0` | requires |
| `@angular/core`                          | `>= 17.0.0 < 18.0.0` | requires |
| `@angular-eslint/eslint-plugin`          | `~17.0.0`            | packages |
| `@angular-eslint/eslint-plugin-template` | `~17.0.0`            | packages |
| `@angular-eslint/template-parser`        | `~17.0.0`            | packages |

### `rename-browser-target-to-build-target`

Rename 'browserTarget' to 'buildTarget'.

**Version:** `17.1.0-beta.5`

**Implementation:** `./src/migrations/update-17-1-0/browser-target-to-build-target`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.0.0

### `replace-nguniversal-builders`

Replace usages of '@nguniversal/builders' with '@angular-devkit/build-angular'.

**Version:** `17.1.0-beta.5`

**Implementation:** `./src/migrations/update-17-1-0/replace-nguniversal-builders`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.0.0

### `replace-nguniversal-engines`

Replace usages of '@nguniversal/' packages with '@angular/ssr'.

**Version:** `17.1.0-beta.5`

**Implementation:** `./src/migrations/update-17-1-0/replace-nguniversal-engines`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.0.0

### `update-angular-cli-version-17-0-0`

Update the @angular/cli package version to ~17.0.0.

**Version:** `17.1.0-beta.5`

**Implementation:** `./src/migrations/update-17-1-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.0.0

### `update-zone-js-deep-import`

Replace the deep imports from 'zone.js/dist/zone' and 'zone.js/dist/zone-testing' with 'zone.js' and 'zone.js/testing'.

**Version:** `17.1.0-beta.5`

**Implementation:** `./src/migrations/update-17-1-0/update-zone-js-deep-import`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.0.0

### `update-17.1.0-jest`

Update dependencies to version 17.1.0-jest

**Version:** `17.1.0-jest`

#### Package Updates

This migration updates the following packages:

| Package                             | Version            | Type     |
| ----------------------------------- | ------------------ | -------- |
| `@angular-devkit/build-angular`     | `>=13.0.0 <18.0.0` | requires |
| `@angular/compiler-cli`             | `>=13.0.0 <18.0.0` | requires |
| `@angular/core`                     | `>=13.0.0 <18.0.0` | requires |
| `@angular/platform-browser-dynamic` | `>=13.0.0 <18.0.0` | requires |
| `jest`                              | `^29.0.0`          | requires |
| `jest-preset-angular`               | `~13.1.3`          | packages |

### `update-17.1.3-jest`

Update dependencies to version 17.1.3-jest

**Version:** `17.1.3-jest`

#### Package Updates

This migration updates the following packages:

| Package                             | Version            | Type     |
| ----------------------------------- | ------------------ | -------- |
| `@angular-devkit/build-angular`     | `>=13.0.0 <18.0.0` | requires |
| `@angular/compiler-cli`             | `>=13.0.0 <18.0.0` | requires |
| `@angular/core`                     | `>=13.0.0 <18.0.0` | requires |
| `@angular/platform-browser-dynamic` | `>=13.0.0 <18.0.0` | requires |
| `jest`                              | `^29.0.0`          | requires |
| `jest-preset-angular`               | `~13.1.4`          | packages |

### `rename-webpack-dev-server-executor`

Rename '@nx/angular:webpack-dev-server' executor to '@nx/angular:dev-server'

**Version:** `17.2.0-beta.2`

**Implementation:** `./src/migrations/update-17-2-0/rename-webpack-dev-server`

### `update-17.2.0-ngrx`

Update dependencies to version 17.2.0-ngrx

**Version:** `17.2.0-ngrx`

#### Package Updates

This migration updates the following packages:

| Package         | Version   | Type     |
| --------------- | --------- | -------- |
| `@angular/core` | `^17.0.0` | requires |
| `@ngrx/store`   | `~17.0.0` | packages |

### `update-17.3.0`

Update dependencies to version 17.3.0

**Version:** `17.3.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=17.0.0 <17.1.0` | requires |
| `@angular-devkit/build-angular` | `~17.1.0`          | packages |
| `@angular-devkit/core`          | `~17.1.0`          | packages |
| `@angular-devkit/schematics`    | `~17.1.0`          | packages |
| `@angular/pwa`                  | `~17.1.0`          | packages |
| `@angular/ssr`                  | `~17.1.0`          | packages |
| `@schematics/angular`           | `~17.1.0`          | packages |
| `@angular-devkit/architect`     | `~0.1701.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1701.0`        | packages |
| `@angular/core`                 | `~17.1.0`          | packages |
| `@angular/material`             | `~17.1.0`          | packages |
| `@angular/cdk`                  | `~17.1.0`          | packages |
| `ng-packagr`                    | `~17.1.0`          | packages |
| `zone.js`                       | `~0.14.3`          | packages |

### `add-autoprefixer-dependency`

Add 'autoprefixer' as dev dependency when '@nx/angular:ng-packagr-lite' or '@nx/angular:package` is used.

**Version:** `17.3.0-beta.10`

**Implementation:** `./src/migrations/update-17-3-0/add-autoprefixer-dependency`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.1.0

### `add-browser-sync-dependency`

Add 'browser-sync' as dev dependency when '@angular-devkit/build-angular:ssr-dev-server' or '@nx/angular:module-federation-dev-ssr' is used.

**Version:** `17.3.0-beta.10`

**Implementation:** `./src/migrations/update-17-3-0/add-browser-sync-dependency`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.1.0

### `update-angular-cli-version-17-1-0`

Update the @angular/cli package version to ~17.1.0.

**Version:** `17.3.0-beta.10`

**Implementation:** `./src/migrations/update-17-3-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.1.0

### `update-17.3.0-types-node`

Update dependencies to version 17.3.0-types-node

**Version:** `17.3.0-types-node`

#### Package Updates

This migration updates the following packages:

| Package       | Version    | Type     |
| ------------- | ---------- | -------- |
| `@types/node` | `^18.16.9` | packages |

### `add-module-federation-env-var-to-target-defaults`

Add NX_MF_DEV_SERVER_STATIC_REMOTES to inputs for task hashing when '@nx/angular:webpack-browser' is used for Module Federation.

**Version:** `18.0.0-beta.0`

**Implementation:** `./src/migrations/update-18-0-0/add-mf-env-var-to-target-defaults`

### `update-18.1.0`

Update dependencies to version 18.1.0

**Version:** `18.1.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=17.1.0 <17.2.0` | requires |
| `@angular-devkit/build-angular` | `~17.2.0`          | packages |
| `@angular-devkit/core`          | `~17.2.0`          | packages |
| `@angular-devkit/schematics`    | `~17.2.0`          | packages |
| `@angular/pwa`                  | `~17.2.0`          | packages |
| `@angular/ssr`                  | `~17.2.0`          | packages |
| `@schematics/angular`           | `~17.2.0`          | packages |
| `@angular-devkit/architect`     | `~0.1702.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1702.0`        | packages |
| `@angular/core`                 | `~17.2.0`          | packages |
| `@angular/material`             | `~17.2.0`          | packages |
| `@angular/cdk`                  | `~17.2.0`          | packages |
| `ng-packagr`                    | `~17.2.0`          | packages |

### `update-angular-cli-version-17-2-0`

Update the @angular/cli package version to ~17.2.0.

**Version:** `18.1.0-beta.1`

**Implementation:** `./src/migrations/update-18-1-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.2.0

### `update-18.1.0-jest`

Update dependencies to version 18.1.0-jest

**Version:** `18.1.0-jest`

#### Package Updates

This migration updates the following packages:

| Package                             | Version            | Type     |
| ----------------------------------- | ------------------ | -------- |
| `@angular-devkit/build-angular`     | `>=15.0.0 <18.0.0` | requires |
| `@angular/compiler-cli`             | `>=15.0.0 <18.0.0` | requires |
| `@angular/core`                     | `>=15.0.0 <18.0.0` | requires |
| `@angular/platform-browser-dynamic` | `>=15.0.0 <18.0.0` | requires |
| `jest`                              | `^29.0.0`          | requires |
| `jest-preset-angular`               | `~14.0.3`          | packages |

### `fix-target-defaults-for-webpack-browser`

Ensure targetDefaults inputs for task hashing when '@nx/angular:webpack-browser' is used are correct for Module Federation.

**Version:** `18.1.1-beta.0`

**Implementation:** `./src/migrations/update-18-1-1/fix-target-defaults-inputs`

### `update-18.2.0`

Update dependencies to version 18.2.0

**Version:** `18.2.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=17.2.0 <17.3.0` | requires |
| `@angular-devkit/build-angular` | `~17.3.0`          | packages |
| `@angular-devkit/core`          | `~17.3.0`          | packages |
| `@angular-devkit/schematics`    | `~17.3.0`          | packages |
| `@angular/pwa`                  | `~17.3.0`          | packages |
| `@angular/ssr`                  | `~17.3.0`          | packages |
| `@schematics/angular`           | `~17.3.0`          | packages |
| `@angular-devkit/architect`     | `~0.1703.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1703.0`        | packages |
| `@angular/core`                 | `~17.3.0`          | packages |
| `@angular/material`             | `~17.3.0`          | packages |
| `@angular/cdk`                  | `~17.3.0`          | packages |
| `ng-packagr`                    | `~17.3.0`          | packages |

### `update-18.2.0-angular-eslint`

Update dependencies to version 18.2.0-angular-eslint

**Version:** `18.2.0-angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                  | Version              | Type     |
| ---------------------------------------- | -------------------- | -------- | ------- | -------- |
| `eslint`                                 | `^7.20.0             |          | ^8.0.0` | requires |
| `@angular/core`                          | `>= 17.0.0 < 18.0.0` | requires |
| `@angular-eslint/eslint-plugin`          | `~17.3.0`            | packages |
| `@angular-eslint/eslint-plugin-template` | `~17.3.0`            | packages |
| `@angular-eslint/template-parser`        | `~17.3.0`            | packages |

### `update-angular-cli-version-17-3-0`

Update the @angular/cli package version to ~17.3.0.

**Version:** `18.2.0-beta.0`

**Implementation:** `./src/migrations/update-18-2-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=17.3.0

### `update-19.1.0`

Update dependencies to version 19.1.0

**Version:** `19.1.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=17.3.0 <18.0.0` | requires |
| `@angular-devkit/build-angular` | `~18.0.0`          | packages |
| `@angular-devkit/core`          | `~18.0.0`          | packages |
| `@angular-devkit/schematics`    | `~18.0.0`          | packages |
| `@angular/pwa`                  | `~18.0.0`          | packages |
| `@angular/ssr`                  | `~18.0.0`          | packages |
| `@schematics/angular`           | `~18.0.0`          | packages |
| `@angular-devkit/architect`     | `~0.1800.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1800.0`        | packages |
| `@angular/core`                 | `~18.0.0`          | packages |
| `@angular/material`             | `~18.0.0`          | packages |
| `@angular/cdk`                  | `~18.0.0`          | packages |
| `ng-packagr`                    | `~18.0.0`          | packages |

### `update-angular-cli-version-18-0-0`

Update the @angular/cli package version to ~18.0.0.

**Version:** `19.1.0-beta.2`

**Implementation:** `./src/migrations/update-19-1-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=18.0.0

### `update-19.1.0-jest`

Update dependencies to version 19.1.0-jest

**Version:** `19.1.0-jest`

#### Package Updates

This migration updates the following packages:

| Package                             | Version            | Type     |
| ----------------------------------- | ------------------ | -------- |
| `@angular-devkit/build-angular`     | `>=15.0.0 <19.0.0` | requires |
| `@angular/compiler-cli`             | `>=15.0.0 <19.0.0` | requires |
| `@angular/core`                     | `>=15.0.0 <19.0.0` | requires |
| `@angular/platform-browser-dynamic` | `>=15.0.0 <19.0.0` | requires |
| `jest`                              | `^29.0.0`          | requires |
| `jest-preset-angular`               | `~14.1.0`          | packages |

### `update-19.1.2`

Update dependencies to version 19.1.2

**Version:** `19.1.2`

#### Package Updates

This migration updates the following packages:

| Package                                    | Version              | Type     |
| ------------------------------------------ | -------------------- | -------- | ------- | -------- |
| `eslint`                                   | `^8.57.0             |          | ^9.0.0` | requires |
| `@angular/core`                            | `>= 18.0.0 < 19.0.0` | requires |
| `@angular-eslint/eslint-plugin`            | `^18.0.1`            | packages |
| `@angular-eslint/eslint-plugin-template`   | `^18.0.1`            | packages |
| `@angular-eslint/template-parser`          | `^18.0.1`            | packages |
| `@angular-eslint/utils`                    | `^18.0.1`            | packages |
| `@angular-eslint/schematics`               | `^18.0.1`            | packages |
| `@angular-eslint/test-utils`               | `^18.0.1`            | packages |
| `@angular-eslint/builder`                  | `^18.0.1`            | packages |
| `@angular-eslint/bundled-angular-compiler` | `^18.0.1`            | packages |

### `add-typescript-eslint-utils`

Installs the '@typescript-eslint/utils' package when having installed '@angular-eslint/eslint-plugin' or '@angular-eslint/eslint-plugin-template' with version &gt;=18.0.0.

**Version:** `19.2.1-beta.0`

**Implementation:** `./src/migrations/update-19-2-1/add-typescript-eslint-utils`

#### Requirements

This migration requires the following:

- `@angular-eslint/eslint-plugin` >=18.0.0

### `update-19.4.0-ngrx`

Update dependencies to version 19.4.0-ngrx

**Version:** `19.4.0-ngrx`

#### Package Updates

This migration updates the following packages:

| Package         | Version   | Type     |
| --------------- | --------- | -------- |
| `@angular/core` | `^18.0.0` | requires |
| `@ngrx/store`   | `^18.0.0` | packages |

### `update-19.5.0`

Update dependencies to version 19.5.0

**Version:** `19.5.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=18.0.0 <18.1.0` | requires |
| `@angular-devkit/build-angular` | `~18.1.0`          | packages |
| `@angular-devkit/core`          | `~18.1.0`          | packages |
| `@angular-devkit/schematics`    | `~18.1.0`          | packages |
| `@angular/build`                | `~18.1.0`          | packages |
| `@angular/pwa`                  | `~18.1.0`          | packages |
| `@angular/ssr`                  | `~18.1.0`          | packages |
| `@schematics/angular`           | `~18.1.0`          | packages |
| `@angular-devkit/architect`     | `~0.1801.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1801.0`        | packages |
| `@angular/core`                 | `~18.1.0`          | packages |
| `@angular/material`             | `~18.1.0`          | packages |
| `@angular/cdk`                  | `~18.1.0`          | packages |
| `ng-packagr`                    | `~18.1.0`          | packages |

### `update-angular-cli-version-18-1-0`

Update the @angular/cli package version to ~18.1.0.

**Version:** `19.5.0-beta.1`

**Implementation:** `./src/migrations/update-19-5-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=18.1.0

### `update-19.5.0-module-federation`

Update dependencies to version 19.5.0-module-federation

**Version:** `19.5.0-module-federation`

#### Package Updates

This migration updates the following packages:

| Package                   | Version  | Type     |
| ------------------------- | -------- | -------- |
| `@module-federation/node` | `^2.3.0` | packages |

### `update-19.5.4-ngrx`

Update dependencies to version 19.5.4-ngrx

**Version:** `19.5.4-ngrx`

#### Package Updates

This migration updates the following packages:

| Package           | Version   | Type     |
| ----------------- | --------- | -------- |
| `@angular/core`   | `^18.0.0` | requires |
| `@ngrx/store`     | `^18.0.1` | packages |
| `@ngrx/operators` | `^18.0.1` | packages |

### `update-19.6.0`

Update dependencies to version 19.6.0

**Version:** `19.6.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=18.1.0 <18.2.0` | requires |
| `@angular-devkit/build-angular` | `~18.2.0`          | packages |
| `@angular-devkit/core`          | `~18.2.0`          | packages |
| `@angular-devkit/schematics`    | `~18.2.0`          | packages |
| `@angular/build`                | `~18.2.0`          | packages |
| `@angular/pwa`                  | `~18.2.0`          | packages |
| `@angular/ssr`                  | `~18.2.0`          | packages |
| `@schematics/angular`           | `~18.2.0`          | packages |
| `@angular-devkit/architect`     | `~0.1802.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1802.0`        | packages |
| `@angular/core`                 | `~18.2.0`          | packages |
| `@angular/material`             | `~18.2.0`          | packages |
| `@angular/cdk`                  | `~18.2.0`          | packages |
| `ng-packagr`                    | `~18.2.0`          | packages |
| `zone.js`                       | `~0.14.10`         | packages |

### `update-19-6-0`

Ensure Module Federation DTS is turned off by default.

**Version:** `19.6.0-beta.4`

**Implementation:** `./src/migrations/update-19-6-0/turn-off-dts-by-default`

### `update-angular-cli-version-18-2-0`

Update the @angular/cli package version to ~18.2.0.

**Version:** `19.6.0-beta.7`

**Implementation:** `./src/migrations/update-19-6-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=18.2.0

### `update-19-6-1-ensure-module-federation-target-defaults`

Ensure Target Defaults are set correctly for Module Federation.

**Version:** `19.6.1-beta.0`

**Implementation:** `./src/migrations/update-19-6-1/ensure-depends-on-for-mf`

### `update-19.6.1-ngrx`

Update dependencies to version 19.6.1-ngrx

**Version:** `19.6.1-ngrx`

#### Package Updates

This migration updates the following packages:

| Package         | Version   | Type     |
| --------------- | --------- | -------- |
| `@angular/core` | `^18.0.0` | requires |
| `@ngrx/store`   | `^18.0.2` | packages |

### `update-19.7.0`

Update dependencies to version 19.7.0

**Version:** `19.7.0`

#### Package Updates

This migration updates the following packages:

| Package                       | Version  | Type     |
| ----------------------------- | -------- | -------- |
| `@module-federation/enhanced` | `~0.6.0` | packages |
| `@module-federation/node`     | `~2.5.0` | packages |

### `update-20.2.0`

Update dependencies to version 20.2.0

**Version:** `20.2.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=18.2.0 <19.0.0` | requires |
| `@angular-devkit/build-angular` | `~19.0.0`          | packages |
| `@angular-devkit/core`          | `~19.0.0`          | packages |
| `@angular-devkit/schematics`    | `~19.0.0`          | packages |
| `@angular/build`                | `~19.0.0`          | packages |
| `@angular/pwa`                  | `~19.0.0`          | packages |
| `@angular/ssr`                  | `~19.0.0`          | packages |
| `@schematics/angular`           | `~19.0.0`          | packages |
| `@angular-devkit/architect`     | `~0.1900.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1900.0`        | packages |
| `@angular/core`                 | `~19.0.0`          | packages |
| `@angular/material`             | `~19.0.0`          | packages |
| `@angular/cdk`                  | `~19.0.0`          | packages |
| `@angular/google-maps`          | `~19.0.0`          | packages |
| `ng-packagr`                    | `~19.0.0`          | packages |
| `zone.js`                       | `~0.15.0`          | packages |

### `update-20.2.0-analog`

Update dependencies to version 20.2.0-analog

**Version:** `20.2.0-analog`

#### Package Updates

This migration updates the following packages:

| Package                         | Version   | Type     |
| ------------------------------- | --------- | -------- |
| `@analogjs/vitest-angular`      | `~1.10.0` | packages |
| `@analogjs/vite-plugin-angular` | `~1.10.0` | packages |

### `update-20.2.0-angular-eslint`

Update dependencies to version 20.2.0-angular-eslint

**Version:** `20.2.0-angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                    | Version              | Type     |
| ------------------------------------------ | -------------------- | -------- | ------- | -------- |
| `eslint`                                   | `^8.57.0             |          | ^9.0.0` | requires |
| `@angular/core`                            | `>= 19.0.0 < 20.0.0` | requires |
| `angular-eslint`                           | `^19.0.0`            | packages |
| `@angular-eslint/eslint-plugin`            | `^19.0.0`            | packages |
| `@angular-eslint/eslint-plugin-template`   | `^19.0.0`            | packages |
| `@angular-eslint/template-parser`          | `^19.0.0`            | packages |
| `@angular-eslint/utils`                    | `^19.0.0`            | packages |
| `@angular-eslint/schematics`               | `^19.0.0`            | packages |
| `@angular-eslint/test-utils`               | `^19.0.0`            | packages |
| `@angular-eslint/builder`                  | `^19.0.0`            | packages |
| `@angular-eslint/bundled-angular-compiler` | `^19.0.0`            | packages |

### `update-20-2-0-update-module-federation-config-import`

Update the ModuleFederationConfig import use @nx/module-federation.

**Version:** `20.2.0-beta.2`

**Implementation:** `./src/migrations/update-20-2-0/migrate-mf-imports-to-new-package`

### `update-20-2-0-update-with-module-federation-import`

Update the withModuleFederation import use @nx/module-federation/angular.

**Version:** `20.2.0-beta.2`

**Implementation:** `./src/migrations/update-20-2-0/migrate-with-mf-import-to-new-package`

### `add-localize-polyfill-to-targets`

Add the '@angular/localize/init' polyfill to the 'polyfills' option of targets using esbuild-based executors.

**Version:** `20.2.0-beta.5`

**Implementation:** `./src/migrations/update-20-2-0/add-localize-polyfill-to-targets`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.0.0

### `update-angular-cli-version-19-0-0`

Update the @angular/cli package version to ~19.0.0.

**Version:** `20.2.0-beta.5`

**Implementation:** `./src/migrations/update-20-2-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.0.0

### `update-angular-ssr-imports-to-use-node-entry-point`

Update '@angular/ssr' import paths to use the new '/node' entry point when 'CommonEngine' is detected.

**Version:** `20.2.0-beta.5`

**Implementation:** `./src/migrations/update-20-2-0/update-angular-ssr-imports-to-use-node-entry-point`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.0.0

### `disable-angular-eslint-prefer-standalone`

Disable the Angular ESLint prefer-standalone rule if not set.

**Version:** `20.2.0-beta.6`

**Implementation:** `./src/migrations/update-20-2-0/disable-angular-eslint-prefer-standalone`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.0.0

### `remove-angular-eslint-rules`

Remove Angular ESLint rules that were removed in v19.0.0.

**Version:** `20.2.0-beta.8`

**Implementation:** `./src/migrations/update-20-2-0/remove-angular-eslint-rules`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.0.0

### `remove-tailwind-config-from-ng-packagr-executors`

Remove the deprecated 'tailwindConfig' option from ng-packagr executors. Tailwind CSS configurations located at the project or workspace root will be picked up automatically.

**Version:** `20.2.0-beta.8`

**Implementation:** `./src/migrations/update-20-2-0/remove-tailwind-config-from-ng-packagr-executors`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.0.0

### `update-20.2.0-jest`

Update dependencies to version 20.2.0-jest

**Version:** `20.2.0-jest`

#### Package Updates

This migration updates the following packages:

| Package                             | Version            | Type     |
| ----------------------------------- | ------------------ | -------- |
| `@angular-devkit/build-angular`     | `>=15.0.0 <20.0.0` | requires |
| `@angular/compiler-cli`             | `>=15.0.0 <20.0.0` | requires |
| `@angular/core`                     | `>=15.0.0 <20.0.0` | requires |
| `@angular/platform-browser-dynamic` | `>=15.0.0 <20.0.0` | requires |
| `jest`                              | `^29.0.0`          | requires |
| `jest-preset-angular`               | `~14.4.0`          | packages |

### `update-20.2.0-module-federation`

Update dependencies to version 20.2.0-module-federation

**Version:** `20.2.0-module-federation`

#### Package Updates

This migration updates the following packages:

| Package                       | Version  | Type     |
| ----------------------------- | -------- | -------- |
| `@module-federation/enhanced` | `0.7.6`  | packages |
| `@module-federation/runtime`  | `0.7.6`  | packages |
| `@module-federation/sdk`      | `0.7.6`  | packages |
| `@module-federation/node`     | `2.6.11` | packages |

### `update-20.2.2-angular-eslint`

Update dependencies to version 20.2.2-angular-eslint

**Version:** `20.2.2-angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                    | Version              | Type     |
| ------------------------------------------ | -------------------- | -------- | ------- | -------- |
| `eslint`                                   | `^8.57.0             |          | ^9.0.0` | requires |
| `@angular/core`                            | `>= 19.0.0 < 20.0.0` | requires |
| `angular-eslint`                           | `^19.0.2`            | packages |
| `@angular-eslint/eslint-plugin`            | `^19.0.2`            | packages |
| `@angular-eslint/eslint-plugin-template`   | `^19.0.2`            | packages |
| `@angular-eslint/template-parser`          | `^19.0.2`            | packages |
| `@angular-eslint/utils`                    | `^19.0.2`            | packages |
| `@angular-eslint/schematics`               | `^19.0.2`            | packages |
| `@angular-eslint/test-utils`               | `^19.0.2`            | packages |
| `@angular-eslint/builder`                  | `^19.0.2`            | packages |
| `@angular-eslint/bundled-angular-compiler` | `^19.0.2`            | packages |

### `update-20.2.3-ngrx`

Update dependencies to version 20.2.3-ngrx

**Version:** `20.2.3-ngrx`

#### Package Updates

This migration updates the following packages:

| Package         | Version   | Type     |
| --------------- | --------- | -------- |
| `@angular/core` | `^19.0.0` | requires |
| `@ngrx/store`   | `^19.0.0` | packages |

### `ensure-nx-module-federation-package`

If workspace includes Module Federation projects, ensure the new @nx/module-federation package is installed.

**Version:** `20.3.0-beta.2`

**Implementation:** `./src/migrations/update-20-3-0/ensure-nx-module-federation-package`

### `update-20.4.0`

Update dependencies to version 20.4.0

**Version:** `20.4.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=19.0.0 <19.1.0` | requires |
| `@angular-devkit/build-angular` | `~19.1.0`          | packages |
| `@angular-devkit/core`          | `~19.1.0`          | packages |
| `@angular-devkit/schematics`    | `~19.1.0`          | packages |
| `@angular/build`                | `~19.1.0`          | packages |
| `@angular/pwa`                  | `~19.1.0`          | packages |
| `@angular/ssr`                  | `~19.1.0`          | packages |
| `@schematics/angular`           | `~19.1.0`          | packages |
| `@angular-devkit/architect`     | `~0.1901.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1901.0`        | packages |
| `@angular/core`                 | `~19.1.0`          | packages |
| `@angular/material`             | `~19.1.0`          | packages |
| `@angular/cdk`                  | `~19.1.0`          | packages |
| `@angular/google-maps`          | `~19.1.0`          | packages |
| `ng-packagr`                    | `~19.1.0`          | packages |

### `update-angular-cli-version-19-1-0`

Update the @angular/cli package version to ~19.1.0.

**Version:** `20.4.0-beta.1`

**Implementation:** `./src/migrations/update-20-4-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.1.0

### `update-20.5.0`

Update dependencies to version 20.5.0

**Version:** `20.5.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=19.1.0 <19.2.0` | requires |
| `@angular-devkit/build-angular` | `~19.2.0`          | packages |
| `@angular-devkit/core`          | `~19.2.0`          | packages |
| `@angular-devkit/schematics`    | `~19.2.0`          | packages |
| `@angular/build`                | `~19.2.0`          | packages |
| `@angular/pwa`                  | `~19.2.0`          | packages |
| `@angular/ssr`                  | `~19.2.0`          | packages |
| `@schematics/angular`           | `~19.2.0`          | packages |
| `@angular-devkit/architect`     | `~0.1902.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.1902.0`        | packages |
| `@angular/core`                 | `~19.2.0`          | packages |
| `@angular/material`             | `~19.2.1`          | packages |
| `@angular/cdk`                  | `~19.2.1`          | packages |
| `@angular/google-maps`          | `~19.2.1`          | packages |
| `ng-packagr`                    | `~19.2.0`          | packages |

### `update-20.5.0-angular-eslint`

Update dependencies to version 20.5.0-angular-eslint

**Version:** `20.5.0-angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                    | Version              | Type     |
| ------------------------------------------ | -------------------- | -------- | ------- | -------- |
| `eslint`                                   | `^8.57.0             |          | ^9.0.0` | requires |
| `@angular/core`                            | `>= 19.0.0 < 20.0.0` | requires |
| `angular-eslint`                           | `^19.2.0`            | packages |
| `@angular-eslint/eslint-plugin`            | `^19.2.0`            | packages |
| `@angular-eslint/eslint-plugin-template`   | `^19.2.0`            | packages |
| `@angular-eslint/template-parser`          | `^19.2.0`            | packages |
| `@angular-eslint/utils`                    | `^19.2.0`            | packages |
| `@angular-eslint/schematics`               | `^19.2.0`            | packages |
| `@angular-eslint/test-utils`               | `^19.2.0`            | packages |
| `@angular-eslint/builder`                  | `^19.2.0`            | packages |
| `@angular-eslint/bundled-angular-compiler` | `^19.2.0`            | packages |

### `update-angular-cli-version-19-2-0`

Update the @angular/cli package version to ~19.2.0.

**Version:** `20.5.0-beta.5`

**Implementation:** `./src/migrations/update-20-5-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=19.2.0

### `update-20.8.1`

Update dependencies to version 20.8.1

**Version:** `20.8.1`

#### Package Updates

This migration updates the following packages:

| Package              | Version   | Type     |
| -------------------- | --------- | -------- |
| `@nx/angular-rspack` | `^20.7.0` | packages |

### `set-continuous-option`

Set the `continuous` option to `true` for continuous tasks.

**Version:** `21.0.0-beta.3`

**Implementation:** `./src/migrations/update-21-0-0/set-continuous-option`

### `change-data-persistence-operators-imports-to-ngrx-router-store-data-persistence`

Change the data persistence operator imports to '@ngrx/router-store/data-persistence'.

**Version:** `21.0.0-beta.5`

**Implementation:** `./src/migrations/update-21-0-0/change-data-persistence-operators-imports-to-ngrx-router-store-data-persistence`

#### Requirements

This migration requires the following:

- `@ngrx/store` >=16.0.0

### `update-21.1.0`

Update dependencies to version 21.1.0

**Version:** `21.1.0`

#### Package Updates

This migration updates the following packages:

| Package              | Version   | Type     |
| -------------------- | --------- | -------- |
| `@nx/angular-rspack` | `^21.0.1` | packages |

### `update-21.2.0`

Update dependencies to version 21.2.0

**Version:** `21.2.0`

#### Package Updates

This migration updates the following packages:

| Package                         | Version            | Type     |
| ------------------------------- | ------------------ | -------- |
| `@angular/core`                 | `>=19.2.0 <20.0.0` | requires |
| `@angular-devkit/build-angular` | `~20.0.0`          | packages |
| `@angular-devkit/core`          | `~20.0.0`          | packages |
| `@angular-devkit/schematics`    | `~20.0.0`          | packages |
| `@angular/build`                | `~20.0.0`          | packages |
| `@angular/pwa`                  | `~20.0.0`          | packages |
| `@angular/ssr`                  | `~20.0.0`          | packages |
| `@schematics/angular`           | `~20.0.0`          | packages |
| `@angular-devkit/architect`     | `~0.2000.0`        | packages |
| `@angular-devkit/build-webpack` | `~0.2000.0`        | packages |
| `@angular/core`                 | `~20.0.0`          | packages |
| `@angular/material`             | `~20.0.0`          | packages |
| `@angular/cdk`                  | `~20.0.0`          | packages |
| `@angular/google-maps`          | `~20.0.0`          | packages |
| `ng-packagr`                    | `~20.0.0`          | packages |

### `update-21.2.0-@angular-eslint`

Update dependencies to version 21.2.0-@angular-eslint

**Version:** `21.2.0-@angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package                                    | Version              | Type     |
| ------------------------------------------ | -------------------- | -------- | ------- | -------- |
| `@angular/core`                            | `>= 20.0.0 < 21.0.0` | requires |
| `eslint`                                   | `^8.57.0             |          | ^9.0.0` | requires |
| `@angular-eslint/eslint-plugin`            | `^20.0.0`            | packages |
| `@angular-eslint/eslint-plugin-template`   | `^20.0.0`            | packages |
| `@angular-eslint/template-parser`          | `^20.0.0`            | packages |
| `@angular-eslint/utils`                    | `^20.0.0`            | packages |
| `@angular-eslint/schematics`               | `^20.0.0`            | packages |
| `@angular-eslint/test-utils`               | `^20.0.0`            | packages |
| `@angular-eslint/builder`                  | `^20.0.0`            | packages |
| `@angular-eslint/bundled-angular-compiler` | `^20.0.0`            | packages |

### `update-21.2.0-angular-eslint`

Update dependencies to version 21.2.0-angular-eslint

**Version:** `21.2.0-angular-eslint`

#### Package Updates

This migration updates the following packages:

| Package             | Version              | Type     |
| ------------------- | -------------------- | -------- | ------- | -------- |
| `@angular/core`     | `>= 20.0.0 < 21.0.0` | requires |
| `typescript-eslint` | `^8.0.0`             | requires |
| `eslint`            | `^8.57.0             |          | ^9.0.0` | requires |
| `angular-eslint`    | `^20.0.0`            | packages |

### `update-21.2.0-angular-rspack`

Update dependencies to version 21.2.0-angular-rspack

**Version:** `21.2.0-angular-rspack`

#### Package Updates

This migration updates the following packages:

| Package              | Version   | Type     |
| -------------------- | --------- | -------- |
| `@nx/angular-rspack` | `^21.1.0` | packages |

### `migrate-provide-server-rendering-import`

Migrate imports of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`.

**Version:** `21.2.0-beta.3`

**Implementation:** `./src/migrations/update-21-2-0/migrate-provide-server-rendering-import`

#### Requirements

This migration requires the following:

- `@angular/core` >=20.0.0

### `replace-provide-server-routing`

Replace `provideServerRouting` and `provideServerRoutesConfig` with `provideServerRendering` using `withRoutes`.

**Version:** `21.2.0-beta.3`

**Implementation:** `./src/migrations/update-21-2-0/replace-provide-server-routing`

#### Requirements

This migration requires the following:

- `@angular/core` >=20.0.0

### `set-generator-defaults-for-previous-style-guide`

Update the generator defaults to maintain the previous style guide behavior.

**Version:** `21.2.0-beta.3`

**Implementation:** `./src/migrations/update-21-2-0/set-generator-defaults-for-previous-style-guide`

#### Requirements

This migration requires the following:

- `@angular/core` >=20.0.0

### `update-angular-cli-version-20-0-0`

Update the @angular/cli package version to ~20.0.0.

**Version:** `21.2.0-beta.3`

**Implementation:** `./src/migrations/update-21-2-0/update-angular-cli`

#### Requirements

This migration requires the following:

- `@angular/core` >=20.0.0

### `update-module-resolution`

Update 'moduleResolution' to 'bundler' in TypeScript configurations. You can read more about this here: https://www.typescriptlang.org/tsconfig/#moduleResolution.

**Version:** `21.2.0-beta.3`

**Implementation:** `./src/migrations/update-21-2-0/update-module-resolution`

#### Requirements

This migration requires the following:

- `@angular/core` >=20.0.0

### `update-21.2.0-jest`

Update dependencies to version 21.2.0-jest

**Version:** `21.2.0-jest`

#### Package Updates

This migration updates the following packages:

| Package                             | Version            | Type     |
| ----------------------------------- | ------------------ | -------- |
| `@angular/compiler-cli`             | `>=15.0.0 <21.0.0` | requires |
| `@angular/core`                     | `>=15.0.0 <21.0.0` | requires |
| `@angular/platform-browser-dynamic` | `>=15.0.0 <21.0.0` | requires |
| `jest`                              | `^29.0.0`          | requires |
| `jest-preset-angular`               | `~14.6.0`          | packages |

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/angular@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/angular@latest --dry-run
```
