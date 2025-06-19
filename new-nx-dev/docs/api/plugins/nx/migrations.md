---
title: '@nx/nx Migrations'
description: 'Complete reference for all @nx/nx migration commands'
sidebar_label: Migrations
---

# @nx/nx Migrations

The @nx/nx plugin provides various migrations to help you update your nx projects and dependencies within your Nx workspace.
Below is a complete reference for all available migrations and their details.

## Available Migrations

### `17.0.0-move-cache-directory`

Updates the default cache directory to .nx/cache

**Version:** `17.0.0-beta.1`

**Implementation:** `./src/migrations/update-17-0-0/move-cache-directory`

### `17.0.0-use-minimal-config-for-tasks-runner-options`

Use minimal config for tasksRunnerOptions

**Version:** `17.0.0-beta.3`

**Implementation:** `./src/migrations/update-17-0-0/use-minimal-config-for-tasks-runner-options`

### `rm-default-collection-npm-scope`

Migration for v17.0.0-rc.1

**Version:** `17.0.0-rc.1`

**Implementation:** `./src/migrations/update-17-0-0/rm-default-collection-npm-scope`

### `17.3.0-update-nx-wrapper`

Updates the nx wrapper.

**Version:** `17.3.0-beta.6`

**Implementation:** `./src/migrations/update-17-3-0/update-nxw`

### `18.0.0-disable-adding-plugins-for-existing-workspaces`

Updates nx.json to disabled adding plugins when generating projects in an existing Nx workspace

**Version:** `18.0.0-beta.2`

**Implementation:** `./src/migrations/update-18-0-0/disable-crystal-for-existing-workspaces`

### `move-default-base-to-nx-json-root`

Moves affected.defaultBase to defaultBase in `nx.json`

**Version:** `18.1.0-beta.3`

**Implementation:** `./src/migrations/update-17-2-0/move-default-base`

### `19-2-0-move-graph-cache-directory`

Updates the default workspace data directory to .nx/workspace-data

**Version:** `19.2.0-beta.2`

**Implementation:** `./src/migrations/update-19-2-0/move-workspace-data-directory`

### `19-2-2-update-nx-wrapper`

Updates the nx wrapper.

**Version:** `19.2.2-beta.0`

**Implementation:** `./src/migrations/update-17-3-0/update-nxw`

### `19-2-4-set-project-name`

Set project name in nx.json explicitly

**Version:** `19.2.4-beta.0`

**Implementation:** `./src/migrations/update-19-2-4/set-project-name`

### `move-use-daemon-process`

Migration for v20.0.0-beta.7

**Version:** `20.0.0-beta.7`

**Implementation:** `./src/migrations/update-20-0-0/move-use-daemon-process`

### `use-legacy-cache`

Set `useLegacyCache` to true for migrating workspaces

**Version:** `20.0.1`

**Implementation:** `./src/migrations/update-20-0-1/use-legacy-cache`

### `remove-custom-tasks-runner`

Removes the legacy cache configuration from nx.json

**Version:** `21.0.0-beta.8`

**Implementation:** `./src/migrations/update-21-0-0/remove-custom-tasks-runner`

### `remove-legacy-cache`

Removes the legacy cache configuration from nx.json

**Version:** `21.0.0-beta.8`

**Implementation:** `./src/migrations/update-21-0-0/remove-legacy-cache`

### `release-changelog-config-changes`

Updates release changelog config based on the breaking changes in Nx v21

**Version:** `21.0.0-beta.11`

**Implementation:** `./src/migrations/update-21-0-0/release-changelog-config-changes`

### `release-version-config-changes`

Updates release version config based on the breaking changes in Nx v21

**Version:** `21.0.0-beta.11`

**Implementation:** `./src/migrations/update-21-0-0/release-version-config-changes`

### `21-1-0-add-ignore-entries-for-nx-rule-files`

Adds **/nx-rules.mdc and **/nx.instructions.md to .gitignore if not present

**Version:** `21.1.0-beta.2`

**Implementation:** `./src/migrations/update-21-1-0/add-gitignore-entry`

## Running Migrations

To run a specific migration:

```bash
nx migrate @nx/nx@&lt;version&gt;
```

To see what migrations are available:

```bash
nx migrate @nx/nx@latest --dry-run
```
