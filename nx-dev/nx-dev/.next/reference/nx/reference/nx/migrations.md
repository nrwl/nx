For an overview of the plugin and setup instructions, see the [@nx/nx introduction](/docs/reference/nx).

The @nx/nx plugin provides various migrations to help you migrate to newer versions of nx projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.2.x

### `23-2-0-set-cache-on-executor-target-defaults`
**Version**: 23.2.0-beta.8

Sets "cache" on some executor-based target defaults whose caching was previously enabled by a target name default, maintaining compatibility with how cacheability resolved before Nx 23. Keys the migration cannot decide are left alone and keep working through a deprecated runtime fallback.

#### Set cache on executor-based target defaults

Maintains compatibility with how cacheability was resolved before Nx 23.

Target defaults resolve to a single key rather than merging them. When a target matches both a target name key and an executor key, the executor key is the one that applies, and the target name key is not read at all. Earlier versions of Nx also derived cacheability from target names, so `"cache": true` on the target name key still took effect even when an executor key applied. Nx 23 reads cacheability from the resolved target only.

This migration copies `cache` onto each executor key that applies to a target whose target name key enables it, so those targets remain cacheable.

An executor key applies to every target that resolves through it, so the migration updates a key only when it can establish that caching is right for all of them. It leaves the key unchanged when the key already declares `cache`, when it declares `continuous: true`, when every entry on the key is filtered so none of them always applies, when a target through it is continuous or is a long-running target such as `serve`, `dev`, or `start`, when the executor's own schema marks its targets continuous, or when a target through it has no target name key enabling `cache`. It never updates the `nx:run-commands` or `nx:run-script` keys, because targets written with `command` and targets derived from `package.json` scripts resolve through those keys without naming them.

Where the migration makes no change, Nx still decides at run time, per target rather than per key: a target whose target name key enables `cache`, and whose resolved configuration still leaves `cache` undefined, gets it back and is reported as a deprecated fallback. Because that test is applied to the resolved target rather than to the key, it also covers the cases where a key looks decided but is not for this project — an executor key whose entries are all filtered, or whose only `cache` declaration is filtered out here. It equally covers the targets left behind because a sibling target through the same key does not opt in, and the targets reaching the `nx:run-commands` and `nx:run-script` keys. Three cases get no fallback and no warning. A continuous or long-running target, because caching it is invalid. A target whose resolved configuration already sets `cache`. And a target whose target name key was discarded as incompatible, because its entry named an executor the target does not use — before Nx 23 that target was cacheable, since cacheability was matched on target name alone and the entry's `executor` was never read. Restoring it here would mean setting `cache` with no executor key to point the user at and no migration able to retire the behavior, so it is deliberately left alone. Set `cache` on those targets directly.

Targets are read from each project's `project.json` and from the `nx.targets` block of its `package.json`. Targets inferred by a plugin, and targets derived from `package.json` scripts, are not visible to the migration — the latter is why the `nx:run-script` key is never updated. A key that looks safe here may still serve an inferred target. Set `cache` on the executor key by hand only after checking that no target reaching it is continuous; Nx rejects a target that is both cacheable and continuous. Nx names both keys in a run-time warning. That warning is emitted during project graph construction, so while the daemon is running it goes to `.nx/workspace-data/d/daemon.log` rather than the terminal; CI runs, where the daemon is disabled, print it normally.

#### Sample code changes

Given a project with a `build` target that uses the `@nx/angular:webpack-browser` executor:

##### Before

```json title="nx.json"
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "@nx/angular:webpack-browser": {
      "inputs": ["production", "^production"]
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "@nx/angular:webpack-browser": {
      "inputs": ["production", "^production"],
      "cache": true
    }
  }
}
```




## 23.0.x

### `23-0-0-consolidate-release-tag-config`
**Version**: 23.0.0-beta.16

Consolidates any remaining legacy releaseTag* flat properties into the nested releaseTag object. The flat properties were removed in Nx 23.


### `23-0-0-add-migrate-runs-to-git-ignore`
**Version**: 23.0.0-beta.18

Adds .nx/migrate-runs to .gitignore



## 22.7.x

### `22-7-0-add-polygraph-to-git-ignore`
**Version**: 22.7.0-beta.0

Adds .nx/polygraph to .gitignore


### `22-7-0-add-self-healing-to-gitignore`
**Version**: 22.7.0-beta.0

Adds .nx/self-healing to .gitignore

#### Add Self-Healing Directory to Git Ignore

Add gitignore entry for the `.nx/self-healing` directory, which stores local fix context generated by Nx's self-healing CI feature.

#### Sample Code Changes

Adds the following entry to the `.gitignore` file.

```text title=".gitignore"
.nx/self-healing
```




## 22.6.x

### `22-6-1-add-claude-worktrees-to-git-ignore`
**Version**: 22.6.0-beta.10

Adds .claude/worktrees to .gitignore


### `22-6-0-add-claude-settings-local-to-git-ignore`
**Version**: 22.6.0-rc.0

Adds .claude/settings.local.json to .gitignore


### `22-6-0-enable-analytics-prompt`
**Version**: 22.6.0-beta.11

Prompts to enable usage analytics



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

#### Use Legacy Cache

Removes `useLegacyCache` from `nx.json` as it is no longer functional in Nx 21

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "targetDefaults": {},
  "useLegacyCache": true
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {}
}
```



### `remove-custom-tasks-runner`
**Version**: 21.0.0-beta.8

Removes the legacy cache configuration from nx.json

#### Remove Custom Tasks Runners

Removes `tasksRunnerOptions` entries from `nx.json` that contain custom tasks runners. In Nx 21, custom tasks runners are no longer functional. See /deprecated/custom-tasks-runner for more information.

#### Sample Code Changes

Removes custom task runner configuration from `nx.json`.

##### Before

```json title="nx.json"
{
  "targetDefaults": {},
  "tasksRunnerOptions": {
    "default": {
      "runner": "custom-task-runner"
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {}
}
```



### `release-version-config-changes`
**Version**: 21.0.0-beta.11

Updates release version config based on the breaking changes in Nx v21

#### Nx Release Version Config Changes

In Nx v21, the implementation details of versioning were rewritten to massively enhance flexibility and lay the groundwork for future features.

As part of this, some elements of the release configuration were updated. During the lifecycle of Nx v21, you can still opt into the old versioning by setting `release.version.useLegacyVersioning` to `true`, in which case the release configuration should remain unchanged.

In Nx v22, the legacy versioning implementation will be removed entirely and the configuration will have to be updated to match what this migration does for you.

#### Sample Code Changes

"generatorOptions" is longer exists and most non-ecosystem specific options have moved to the top level of "version" and are therefore fully documented on the JSON schema as a core option.

"packageRoot: string" has been replaced by the more flexible concept of "manifestRootsToUpdate: string[]", allowing for multiple manifest files (such as `package.json` in the JS/TS ecosystem)
to be updated in a single versioning run.

Ecosystem specific options, such as "skipLockFileUpdate", which is specific to the JS/TS ecosystem, are available via the new "versionActionsOptions" object, which is so named because of the new `VersionActions` abstraction introduced in Nx v21,
which allows for different ecosystems and use-cases to be supported via very minimal implementation effort.

"preserveLocalDependencyProtocols" changed from `false` by default to `true` by default in Nx v21, so it can simply be removed from the configuration when set to true.

The migration will also update release groups version configuration, as well as project.json and package.json version configuration, if applicable.

##### Before

```json title="nx.json"
{
  "release": {
    "version": {
      "generatorOptions": {
        "packageRoot": "build/packages/{projectName}",
        "currentVersionResolver": "registry",
        "skipLockFileUpdate": true,
        "preserveLocalDependencyProtocols": true
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "release": {
    "version": {
      "manifestRootsToUpdate": ["build/packages/{projectName}"],
      "currentVersionResolver": "registry",
      "versionActionsOptions": {
        "skipLockFileUpdate": true
      }
    }
  }
}
```



### `release-changelog-config-changes`
**Version**: 21.0.0-beta.11

Updates release changelog config based on the breaking changes in Nx v21

#### Nx Release Changelog Config Changes

In Nx v21, the `mapAuthorsToGitHubUsernames` changelog "renderOption" for the default changelog renderer was renamed to `applyUsernameToAuthors` to reflect the fact that it is no longer specific to GitHub. Most people were not setting this option directly, but if you were, it will be automatically migrated by this migration.

The migration will also update release groups changelog configuration, if applicable.

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "release": {
    "changelog": {
      "workspaceChangelog": {
        "renderOptions": {
          "mapAuthorsToGitHubUsernames": true
        }
      },
      "projectChangelogs": {
        "renderOptions": {
          "mapAuthorsToGitHubUsernames": false
        }
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "release": {
    "changelog": {
      "workspaceChangelog": {
        "renderOptions": {
          "applyUsernameToAuthors": true
        }
      },
      "projectChangelogs": {
        "renderOptions": {
          "applyUsernameToAuthors": false
        }
      }
    }
  }
}
```




## 20.0.x

### `move-use-daemon-process`
**Version**: 20.0.0-beta.7

Migration for v20.0.0-beta.7

#### Move useDaemonProcess

Move the `useDaemonProcess` to the root of `nx.json`

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "useDaemonProcess": false
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "useDaemonProcess": false
}
```



### `use-legacy-cache`
**Version**: 20.0.1

Set `useLegacyCache` to true for migrating workspaces

#### Use Legacy Cache

Set `useLegacyCache` to true for migrating workspaces

#### Sample Code Changes

Add `useLegacyCache` to `nx.json` unless `enableDbCache` was set to true.

##### Before

```json title="nx.json"
{
  "targetDefaults": {}
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {},
  "useLegacyCache": true
}
```




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

#### Sample Code Changes

Add `.nx/cache` to the `.gitignore` file.

##### Before

```text title=".gitignore"
node_modules
```

##### After

```text title=".gitignore" {2}
node_modules
.nx/cache
```

Add `.nx/cache` to the `.prettierignore` file.

##### Before

```ts title=".prettierignore"
/dist
```

##### After

```ts title=".prettierignore" {2}
/dist
.nx/cache
```



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


