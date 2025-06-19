---
title: '@nx/gradle Migrations'
description: 'Complete reference for all @nx/gradle migration commands'
sidebar_label: Migrations
---

# @nx/gradle Migrations

The @nx/gradle plugin provides various migrations to help you update your gradle projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `add-project-report-all`

Add task projectReportAll to build.gradle file

**Version:** `19.4.0-beta.1`

**Implementation:** `./src/migrations/19-4-0/add-project-report-all`

### `change-regex-production-test`

This function changes !&#123;projectRoot&#125;/test/**/\* in nx.json for production to !&#123;projectRoot&#125;/src/test/**/\*

**Version:** `19.4.1-beta.0`

**Implementation:** `./src/migrations/19-4-1/change-regex-test-production`

### `add-include-subprojects-tasks`

Add includeSubprojectsTasks to build.gradle file

**Version:** `20.2.0-beta.4`

**Implementation:** `./src/migrations/20-2-0/add-include-subprojects-tasks`

### `change-plugin-to-v1`

Change @nx/gradle plugin to version 1

**Version:** `21.0.0-beta.5`

**Implementation:** `./src/migrations/21-0-0/change-plugin-to-v1`

### `change-ciTargetName-to-ciTestTargetName`

Change @nx/gradle option from ciTargetName to ciTestTargetName

**Version:** `21.0.0-beta.13`

**Implementation:** `./src/migrations/21-0-0/change-ciTargetName-to-ciTestTargetName`

### `change-plugin-version-0-1-0`

Change dev.nx.gradle.project-graph to version 0.1.0 in build file

**Version:** `21.1.2-beta.1`

**Implementation:** `./src/migrations/21-1-2/change-plugin-version-0-1-0`

### `change-plugin-version-0-1-2`

Change dev.nx.gradle.project-graph to version 0.1.2 in build file

**Version:** `21.3.0-beta.0`

**Implementation:** `./src/migrations/21-3-0/change-plugin-version-0-1-2`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/gradle@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/gradle@latest --dry-run
```
