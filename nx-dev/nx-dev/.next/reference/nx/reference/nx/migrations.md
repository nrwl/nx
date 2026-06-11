The @nx/nx plugin provides various migrations to help you migrate to newer versions of nx projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.7.x

### `22-7-0-add-polygraph-to-git-ignore`
**Version**: 22.7.0-beta.0

Adds .nx/polygraph to .gitignore


### `22-7-0-add-self-healing-to-gitignore`
**Version**: 22.7.0-beta.0

Adds .nx/self-healing to .gitignore



## 22.6.x

### `22-6-1-add-claude-worktrees-to-git-ignore`
**Version**: 22.6.0-beta.10

Adds .claude/worktrees to .gitignore


### `22-6-0-add-claude-settings-local-to-git-ignore`
**Version**: 22.6.0-rc.0

Adds .claude/settings.local.json to .gitignore



## 22.1.x

### `22-1-0-update-nx-wrapper`
**Version**: 22.1.0-beta.5

Updates the nx wrapper.



## 22.0.x

### `22-0-0-release-version-config-changes`
**Version**: 22.0.0-beta.1

Updates release version config based on the breaking changes in Nx v22


### `22-0-0-consolidate-release-tag-config`
**Version**: 22.0.0-beta.2

Consolidates releaseTag* options into nested releaseTag object structure



## 21.0.x

### `remove-legacy-cache`
**Version**: 21.0.0-beta.8

Removes the legacy cache configuration from nx.json


### `remove-custom-tasks-runner`
**Version**: 21.0.0-beta.8

Removes the legacy cache configuration from nx.json


### `release-version-config-changes`
**Version**: 21.0.0-beta.11

Updates release version config based on the breaking changes in Nx v21


### `release-changelog-config-changes`
**Version**: 21.0.0-beta.11

Updates release changelog config based on the breaking changes in Nx v21



## 20.0.x

### `move-use-daemon-process`
**Version**: 20.0.0-beta.7

Migration for v20.0.0-beta.7


### `use-legacy-cache`
**Version**: 20.0.1

Set `useLegacyCache` to true for migrating workspaces



## 19.2.x

### `19-2-0-move-graph-cache-directory`
**Version**: 19.2.0-beta.2

Updates the default workspace data directory to .nx/workspace-data


### `19-2-2-update-nx-wrapper`
**Version**: 19.2.2-beta.0

Updates the nx wrapper.


### `19-2-4-set-project-name`
**Version**: 19.2.4-beta.0

Set project name in nx.json explicitly



## 18.1.x

### `move-default-base-to-nx-json-root`
**Version**: 18.1.0-beta.3

Moves affected.defaultBase to defaultBase in `nx.json`



## 18.0.x

### `18.0.0-disable-adding-plugins-for-existing-workspaces`
**Version**: 18.0.0-beta.2

Updates nx.json to disabled adding plugins when generating projects in an existing Nx workspace



## 17.3.x

### `17.3.0-update-nx-wrapper`
**Version**: 17.3.0-beta.6

Updates the nx wrapper.



## 17.0.x

### `17.0.0-move-cache-directory`
**Version**: 17.0.0-beta.1

Updates the default cache directory to .nx/cache


### `17.0.0-use-minimal-config-for-tasks-runner-options`
**Version**: 17.0.0-beta.3

Use minimal config for tasksRunnerOptions


### `rm-default-collection-npm-scope`
**Version**: 17.0.0-rc.1

Migration for v17.0.0-rc.1



## 16.8.x

### `16.8.0-escape-dollar-sign-env`
**Version**: 16.8.0-beta.3

Escape $ in env variables



## 16.6.x

### `16.6.0-prefix-outputs`
**Version**: 16.6.0-beta.6

Prefix outputs with {workspaceRoot}/{projectRoot} if needed



## 16.2.x

### `16.2.0-remove-output-path-from-run-commands`
**Version**: 16.2.0-beta.0

Remove outputPath from run commands



## 16.0.x

### `16.0.0-remove-nrwl-cli`
**Version**: 16.0.0-beta.0

Remove @nrwl/cli.


### `16.0.0-tokens-for-depends-on`
**Version**: 16.0.0-beta.9

Replace `dependsOn.projects` and `inputs` definitions with new configuration format.


### `16.0.0-update-nx-cloud-runner`
**Version**: 16.0.0-beta.0

Replace @nrwl/nx-cloud with nx-cloud


