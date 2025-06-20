---
title: Nx CLI
description: Complete reference for all Nx CLI commands
---

# Nx CLI

The Nx command line has various subcommands and options to help you manage your Nx workspace and run tasks efficiently.
Below is a complete reference for all available commands and their options.
You can run nx --help to view all available options.

## Available Commands

### `nx add`

Install a plugin and initialize it.

**Usage:**

```bash
nx add <packageSpecifier>
```

#### Options

| Option                   | Type    | Description                                                                                                                                                                                                                                                  | Default |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--help`                 | boolean | Show help                                                                                                                                                                                                                                                    |         |
| `--packageSpecifier`     | string  | The package name and optional version (e.g. `@nx/react` or `@nx/react@latest`) to install and initialize. If the version is not specified it will install the same version as the `nx` package for Nx core plugins or the latest version for other packages. |         |
| `--updatePackageScripts` | boolean | Update `package.json` scripts with inferred targets. Defaults to `true` when the package is a core Nx plugin.                                                                                                                                                |         |
| `--verbose`              | boolean | Prints additional information about the commands (e.g., stack traces).                                                                                                                                                                                       |         |
| `--version`              | boolean | Show version number                                                                                                                                                                                                                                          |         |

### `nx affected`

Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects. See https://nx.dev/ci/features/affected for more details.

**Usage:**

```bash
nx affected
```

#### Options

| Option                                      | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Default |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--all`                                     | boolean | No description **⚠️ Deprecated**: Use `nx run-many` instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |         |
| `--base`                                    | string  | Base of the current branch (usually main).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |         |
| `--batch`                                   | boolean | Run task(s) in batches for executors which support batches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false` |
| `--configuration`, `--c`                    | string  | This is the configuration to use when performing tasks on projects. (alias: `-c`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |         |
| `--exclude`                                 | string  | Exclude certain projects from being processed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |         |
| `--excludeTaskDependencies`                 | boolean | Skips running dependent tasks first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false` |
| `--files`                                   | string  | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |         |
| `--graph`                                   | string  | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         |
| `--head`                                    | string  | Latest commit of the current branch (usually HEAD).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |         |
| `--help`                                    | boolean | Show help                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |         |
| `--nxBail`                                  | boolean | Stop command execution after the first failed task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `false` |
| `--nxIgnoreCycles`                          | boolean | Ignore cycles in the task graph.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `false` |
| `--outputStyle`                             | string  | Defines how Nx emits outputs tasks logs. **tui**: enables the Nx Terminal UI, recommended for local development environments. **dynamic-legacy**: use dynamic-legacy output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended for local development environments where tui is not supported. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. (choices: `dynamic-legacy`, `dynamic`, `tui`, `static`, `stream`, `stream-without-prefixes`) |         |
| `--parallel`                                | string  | Max number of parallel processes [default is 3].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |         |
| `--runner`                                  | string  | This is the name of the tasks runner configured in nx.json.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |         |
| `--skipNxCache`, `--disableNxCache`         | boolean | Rerun the tasks even when the results are available in the cache. (alias: `-disableNxCache`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false` |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean | Disables the remote cache. (alias: `-disableRemoteCache`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `false` |
| `--skipSync`                                | boolean | Skips running the sync generators associated with the tasks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false` |
| `--targets`, `--target`, `--t`              | string  | Tasks to run for affected projects. (alias: `-target`, `-t`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |         |
| `--tuiAutoExit`                             | string  | Whether or not to exit the TUI automatically after all tasks finish, and after how long. If set to `true`, the TUI will exit immediately. If set to `false` the TUI will not automatically exit. If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |         |
| `--uncommitted`                             | boolean | Uncommitted changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |         |
| `--untracked`                               | boolean | Untracked changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |         |
| `--verbose`                                 | boolean | Prints additional information about the commands (e.g., stack traces).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |         |
| `--version`                                 | boolean | Show version number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |         |

### `nx connect`

Connect workspace to Nx Cloud.

**Usage:**

```bash
nx connect
```

#### Options

| Option            | Type    | Description                                                                               | Default |
| ----------------- | ------- | ----------------------------------------------------------------------------------------- | ------- |
| `--generateToken` | boolean | Explicitly asks for a token to be created, do not override existing tokens from Nx Cloud. |         |
| `--help`          | boolean | Show help                                                                                 |         |
| `--verbose`       | boolean | Prints additional information about the commands (e.g., stack traces).                    |         |
| `--version`       | boolean | Show version number                                                                       |         |

### `nx daemon`

Prints information about the Nx Daemon process or starts a daemon process.

**Usage:**

```bash
nx daemon
```

#### Options

| Option      | Type    | Description         | Default |
| ----------- | ------- | ------------------- | ------- |
| `--help`    | boolean | Show help           |         |
| `--start`   | boolean | No description      | `false` |
| `--stop`    | boolean | No description      | `false` |
| `--version` | boolean | Show version number |         |

### `nx format:check`

Check for un-formatted files.

**Usage:**

```bash
nx format:check
```

#### Options

| Option                       | Type    | Description                                                                                                                             | Default |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--all`                      | boolean | Format all projects.                                                                                                                    |         |
| `--base`                     | string  | Base of the current branch (usually main).                                                                                              |         |
| `--exclude`                  | string  | Exclude certain projects from being processed.                                                                                          |         |
| `--files`                    | string  | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |         |
| `--head`                     | string  | Latest commit of the current branch (usually HEAD).                                                                                     |         |
| `--help`                     | boolean | Show help                                                                                                                               |         |
| `--libs-and-apps`            | boolean | Format only libraries and applications files.                                                                                           |         |
| `--projects`                 | string  | Projects to format (comma/space delimited).                                                                                             |         |
| `--sort-root-tsconfig-paths` | boolean | Ensure the workspace's tsconfig compilerOptions.paths are sorted. Warning: This will cause comments in the tsconfig to be lost.         | `true`  |
| `--uncommitted`              | boolean | Uncommitted changes.                                                                                                                    |         |
| `--untracked`                | boolean | Untracked changes.                                                                                                                      |         |
| `--version`                  | boolean | Show version number                                                                                                                     |         |

### `nx format:write`

Overwrite un-formatted files.

**Usage:**

```bash
nx format:write
```

#### Options

| Option                       | Type    | Description                                                                                                                             | Default |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--all`                      | boolean | Format all projects.                                                                                                                    |         |
| `--base`                     | string  | Base of the current branch (usually main).                                                                                              |         |
| `--exclude`                  | string  | Exclude certain projects from being processed.                                                                                          |         |
| `--files`                    | string  | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |         |
| `--head`                     | string  | Latest commit of the current branch (usually HEAD).                                                                                     |         |
| `--help`                     | boolean | Show help                                                                                                                               |         |
| `--libs-and-apps`            | boolean | Format only libraries and applications files.                                                                                           |         |
| `--projects`                 | string  | Projects to format (comma/space delimited).                                                                                             |         |
| `--sort-root-tsconfig-paths` | boolean | Ensure the workspace's tsconfig compilerOptions.paths are sorted. Warning: This will cause comments in the tsconfig to be lost.         | `true`  |
| `--uncommitted`              | boolean | Uncommitted changes.                                                                                                                    |         |
| `--untracked`                | boolean | Untracked changes.                                                                                                                      |         |
| `--version`                  | boolean | Show version number                                                                                                                     |         |

### `nx graph`

Graph dependencies within workspace.

**Usage:**

```bash
nx graph
```

#### Options

| Option            | Type    | Description                                                                                                                             | Default    |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `--affected`      | boolean | Highlight affected projects.                                                                                                            |            |
| `--base`          | string  | Base of the current branch (usually main).                                                                                              |            |
| `--exclude`       | string  | Exclude certain projects from being processed.                                                                                          |            |
| `--file`          | string  | Output file (e.g. --file=output.json or --file=dep-graph.html).                                                                         |            |
| `--files`         | string  | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |            |
| `--focus`         | string  | Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.                       |            |
| `--groupByFolder` | boolean | Group projects by folder in the project graph.                                                                                          |            |
| `--head`          | string  | Latest commit of the current branch (usually HEAD).                                                                                     |            |
| `--help`          | boolean | Show help                                                                                                                               |            |
| `--host`          | string  | Bind the project graph server to a specific ip address.                                                                                 |            |
| `--open`          | boolean | Open the project graph in the browser.                                                                                                  | `true`     |
| `--port`          | number  | Bind the project graph server to a specific port.                                                                                       |            |
| `--print`         | boolean | Print the project graph to stdout in the terminal.                                                                                      |            |
| `--targets`       | string  | The target to show tasks for in the task graph.                                                                                         |            |
| `--uncommitted`   | boolean | Uncommitted changes.                                                                                                                    |            |
| `--untracked`     | boolean | Untracked changes.                                                                                                                      |            |
| `--verbose`       | boolean | Prints additional information about the commands (e.g., stack traces).                                                                  |            |
| `--version`       | boolean | Show version number                                                                                                                     |            |
| `--view`          | string  | Choose whether to view the projects or task graph. (choices: `projects`, `tasks`)                                                       | `projects` |
| `--watch`         | boolean | Watch for changes to project graph and update in-browser.                                                                               | `true`     |

### `nx import`

Import code and git history from another repository into this repository.

**Usage:**

```bash
nx import [sourceRepository] [destinationDirectory]
```

#### Options

| Option                                    | Type    | Description                                                                    | Default |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------ | ------- |
| `--depth`                                 | number  | The depth to clone the source repository (limit this for faster git clone).    |         |
| `--destinationDirectory`, `--destination` | string  | The directory in the current workspace to import into. (alias: `-destination`) |         |
| `--help`                                  | boolean | Show help                                                                      |         |
| `--interactive`                           | boolean | Interactive mode.                                                              | `true`  |
| `--ref`                                   | string  | The branch from the source repository to import.                               |         |
| `--sourceDirectory`, `--source`           | string  | The directory in the source repository to import from. (alias: `-source`)      |         |
| `--sourceRepository`                      | string  | The remote URL of the source to import.                                        |         |
| `--verbose`                               | boolean | Prints additional information about the commands (e.g., stack traces).         |         |
| `--version`                               | boolean | Show version number                                                            |         |

### `nx init`

Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.

**Usage:**

```bash
nx init
```

#### Options

| Option                   | Type    | Description                                                                                                    | Default |
| ------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- | ------- |
| `--force`                | boolean | Force the migration to continue and ignore custom webpack setup or uncommitted changes. Only for CRA projects. | `false` |
| `--help`                 | boolean | Show help                                                                                                      |         |
| `--interactive`          | boolean | When false disables interactive input prompts for options.                                                     | `true`  |
| `--nxCloud`              | boolean | Set up distributed caching with Nx Cloud.                                                                      |         |
| `--useDotNxInstallation` | boolean | Initialize an Nx workspace setup in the .nx directory of the current repository.                               | `false` |
| `--version`              | boolean | Show version number                                                                                            |         |

### `nx list`

Lists installed plugins, capabilities of installed plugins and other available plugins.

**Usage:**

```bash
nx list [plugin]
```

#### Options

| Option      | Type    | Description                               | Default |
| ----------- | ------- | ----------------------------------------- | ------- |
| `--help`    | boolean | Show help                                 |         |
| `--plugin`  | string  | The name of an installed plugin to query. |         |
| `--version` | boolean | Show version number                       |         |

### `nx login`

Login to Nx Cloud. This command is an alias for [`nx-cloud login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login).

**Usage:**

```bash
nx login [nxCloudUrl]
```

#### Options

| Option         | Type    | Description                                                                                                                                              | Default |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--help`       | boolean | Show help                                                                                                                                                |         |
| `--nxCloudUrl` | string  | The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to https://cloud.nx.app. |         |
| `--verbose`    | boolean | Prints additional information about the commands (e.g., stack traces).                                                                                   |         |
| `--version`    | boolean | Show version number                                                                                                                                      |         |

### `nx logout`

Logout from Nx Cloud. This command is an alias for [`nx-cloud logout`](/ci/reference/nx-cloud-cli#npx-nxcloud-logout).

**Usage:**

```bash
nx logout
```

#### Options

| Option      | Type    | Description                                                            | Default |
| ----------- | ------- | ---------------------------------------------------------------------- | ------- |
| `--help`    | boolean | Show help                                                              |         |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |         |
| `--version` | boolean | Show version number                                                    |         |

### `nx migrate`

Creates a migrations file or runs migrations from the migrations file.

- Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
- Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.

**Usage:**

```bash
nx migrate [packageAndVersion]
```

#### Options

| Option                       | Type    | Description                                                                                                                           | Default                  |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `--commitPrefix`             | string  | Commit prefix to apply to the commit for each migration, when --create-commits is enabled.                                            | `chore: [nx migration] ` |
| `--createCommits`, `--C`     | boolean | Automatically create a git commit after each migration runs. (alias: `-C`)                                                            | `false`                  |
| `--excludeAppliedMigrations` | boolean | Exclude migrations that should have been applied on previous updates. To be used with --from.                                         | `false`                  |
| `--from`                     | string  | Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nx/react@16.0.0,@nx/js@16.0.0"). |                          |
| `--help`                     | boolean | Show help                                                                                                                             |                          |
| `--ifExists`                 | boolean | Run migrations only if the migrations file exists, if not continues successfully.                                                     | `false`                  |
| `--interactive`              | boolean | Enable prompts to confirm whether to collect optional package updates and migrations.                                                 | `false`                  |
| `--packageAndVersion`        | string  | The target package and version (e.g, @nx/workspace@16.0.0).                                                                           |                          |
| `--runMigrations`            | string  | Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json).                               |                          |
| `--to`                       | string  | Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nx/react@16.0.0,@nx/js@16.0.0").  |                          |
| `--verbose`                  | boolean | Prints additional information about the commands (e.g., stack traces).                                                                |                          |
| `--version`                  | boolean | Show version number                                                                                                                   |                          |

### `nx release`

Orchestrate versioning and publishing of applications and libraries.

**Usage:**

```bash
nx release
```

#### Options

| Option                       | Type    | Description                                                                                           | Default |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------- | ------- |
| `--dry-run`, `--d`           | boolean | Preview the changes without updating files/creating releases. (alias: `-d`)                           | `false` |
| `--groups`, `--group`, `--g` | string  | One or more release groups to target with the current command. (alias: `-group`, `-g`)                |         |
| `--help`                     | boolean | Show help                                                                                             |         |
| `--printConfig`              | string  | Print the resolved nx release configuration that would be used for the current command and then exit. |         |
| `--projects`, `--p`          | string  | Projects to run. (comma/space delimited project names and/or patterns). (alias: `-p`)                 |         |
| `--verbose`                  | boolean | Prints additional information about the commands (e.g., stack traces).                                |         |
| `--version`                  | boolean | Show version number                                                                                   |         |

### `nx repair`

Repair any configuration that is no longer supported by Nx.

    Specifically, this will run every migration within the `nx` package
    against the current repository. Doing so should fix any configuration
    details left behind if the repository was previously updated to a new
    Nx version without using `nx migrate`.

    If your repository has only ever updated to newer versions of Nx with
    `nx migrate`, running `nx repair` should do nothing.

**Usage:**

```bash
nx repair
```

#### Options

| Option      | Type    | Description                                                            | Default |
| ----------- | ------- | ---------------------------------------------------------------------- | ------- |
| `--help`    | boolean | Show help                                                              |         |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |         |
| `--version` | boolean | Show version number                                                    |         |

### `nx report`

Reports useful version numbers to copy into the Nx issue template.

**Usage:**

```bash
nx report
```

### `nx reset`

Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.

**Usage:**

```bash
nx reset
```

#### Options

| Option                | Type    | Description                                                                                                                                     | Default |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--help`              | boolean | Show help                                                                                                                                       |         |
| `--onlyCache`         | boolean | Clears the Nx cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache.                        |         |
| `--onlyCloud`         | boolean | Resets the Nx Cloud client. NOTE: Does not clear the remote cache.                                                                              |         |
| `--onlyDaemon`        | boolean | Stops the Nx Daemon, it will be restarted fresh when the next Nx command is run.                                                                |         |
| `--onlyWorkspaceData` | boolean | Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc). |         |
| `--version`           | boolean | Show version number                                                                                                                             |         |

### `nx run`

Run a target for a project
(e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.

**Usage:**

```bash
nx run [project][:target][:configuration] [_..]
```

#### Options

| Option                                      | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Default |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--batch`                                   | boolean | Run task(s) in batches for executors which support batches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false` |
| `--configuration`, `--c`                    | string  | This is the configuration to use when performing tasks on projects. (alias: `-c`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |         |
| `--exclude`                                 | string  | Exclude certain projects from being processed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |         |
| `--excludeTaskDependencies`                 | boolean | Skips running dependent tasks first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false` |
| `--graph`                                   | string  | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         |
| `--nxBail`                                  | boolean | Stop command execution after the first failed task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `false` |
| `--nxIgnoreCycles`                          | boolean | Ignore cycles in the task graph.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `false` |
| `--outputStyle`                             | string  | Defines how Nx emits outputs tasks logs. **tui**: enables the Nx Terminal UI, recommended for local development environments. **dynamic-legacy**: use dynamic-legacy output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended for local development environments where tui is not supported. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. (choices: `tui`, `dynamic`, `dynamic-legacy`, `static`, `stream`, `stream-without-prefixes`) |         |
| `--parallel`                                | string  | Max number of parallel processes [default is 3].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |         |
| `--project`                                 | string  | Target project.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |         |
| `--runner`                                  | string  | This is the name of the tasks runner configured in nx.json.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |         |
| `--skipNxCache`, `--disableNxCache`         | boolean | Rerun the tasks even when the results are available in the cache. (alias: `-disableNxCache`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false` |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean | Disables the remote cache. (alias: `-disableRemoteCache`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `false` |
| `--skipSync`                                | boolean | Skips running the sync generators associated with the tasks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false` |
| `--tuiAutoExit`                             | string  | Whether or not to exit the TUI automatically after all tasks finish, and after how long. If set to `true`, the TUI will exit immediately. If set to `false` the TUI will not automatically exit. If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |         |
| `--verbose`                                 | boolean | Prints additional information about the commands (e.g., stack traces).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |         |
| `--version`                                 | boolean | Show version number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |         |

### `nx run-many`

Run target for multiple listed projects.

**Usage:**

```bash
nx run-many
```

#### Options

| Option                                      | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Default |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--all`                                     | boolean | [deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `true`  |
| `--batch`                                   | boolean | Run task(s) in batches for executors which support batches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false` |
| `--configuration`, `--c`                    | string  | This is the configuration to use when performing tasks on projects. (alias: `-c`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |         |
| `--exclude`                                 | string  | Exclude certain projects from being processed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |         |
| `--excludeTaskDependencies`                 | boolean | Skips running dependent tasks first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false` |
| `--graph`                                   | string  | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         |
| `--help`                                    | boolean | Show help                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |         |
| `--nxBail`                                  | boolean | Stop command execution after the first failed task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `false` |
| `--nxIgnoreCycles`                          | boolean | Ignore cycles in the task graph.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `false` |
| `--outputStyle`                             | string  | Defines how Nx emits outputs tasks logs. **tui**: enables the Nx Terminal UI, recommended for local development environments. **dynamic-legacy**: use dynamic-legacy output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended for local development environments where tui is not supported. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. (choices: `dynamic-legacy`, `dynamic`, `tui`, `static`, `stream`, `stream-without-prefixes`) |         |
| `--parallel`                                | string  | Max number of parallel processes [default is 3].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |         |
| `--projects`, `--p`                         | string  | Projects to run. (comma/space delimited project names and/or patterns). (alias: `-p`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         |
| `--runner`                                  | string  | This is the name of the tasks runner configured in nx.json.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |         |
| `--skipNxCache`, `--disableNxCache`         | boolean | Rerun the tasks even when the results are available in the cache. (alias: `-disableNxCache`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false` |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean | Disables the remote cache. (alias: `-disableRemoteCache`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `false` |
| `--skipSync`                                | boolean | Skips running the sync generators associated with the tasks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false` |
| `--targets`, `--target`, `--t`              | string  | Tasks to run for affected projects. (alias: `-target`, `-t`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |         |
| `--tuiAutoExit`                             | string  | Whether or not to exit the TUI automatically after all tasks finish, and after how long. If set to `true`, the TUI will exit immediately. If set to `false` the TUI will not automatically exit. If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |         |
| `--verbose`                                 | boolean | Prints additional information about the commands (e.g., stack traces).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |         |
| `--version`                                 | boolean | Show version number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |         |

### `nx show`

Show information about the workspace (e.g., list of projects).

**Usage:**

```bash
nx show
```

#### Options

| Option      | Type    | Description         | Default |
| ----------- | ------- | ------------------- | ------- |
| `--help`    | boolean | Show help           |         |
| `--json`    | boolean | Output JSON.        |         |
| `--version` | boolean | Show version number |         |

### `nx sync`

Sync the workspace files by running all the sync generators.

**Usage:**

```bash
nx sync
```

#### Options

| Option      | Type    | Description                                                            | Default |
| ----------- | ------- | ---------------------------------------------------------------------- | ------- |
| `--help`    | boolean | Show help                                                              |         |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |         |
| `--version` | boolean | Show version number                                                    |         |

### `nx sync:check`

Check that no changes are required after running all sync generators.

**Usage:**

```bash
nx sync:check
```

#### Options

| Option      | Type    | Description                                                            | Default |
| ----------- | ------- | ---------------------------------------------------------------------- | ------- |
| `--help`    | boolean | Show help                                                              |         |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |         |
| `--version` | boolean | Show version number                                                    |         |

### `nx view-logs`

Enables you to view and interact with the logs via the advanced analytic UI from Nx Cloud to help you debug your issue. To do this, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details. Only the metrics are uploaded, not the artefacts.

**Usage:**

```bash
nx view-logs
```

### `nx watch`

Watch for changes within projects, and execute commands.

**Usage:**

```bash
nx watch
```

#### Options

| Option                              | Type    | Description                                                                        | Default |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------- | ------- |
| `--all`                             | boolean | Watch all projects.                                                                |         |
| `--help`                            | boolean | Show help                                                                          |         |
| `--includeDependentProjects`, `--d` | boolean | When watching selected projects, include dependent projects as well. (alias: `-d`) |         |
| `--projects`, `--p`                 | string  | Projects to watch (comma/space delimited). (alias: `-p`)                           |         |
| `--verbose`                         | boolean | Run watch mode in verbose mode, where commands are logged before execution.        |         |
| `--version`                         | boolean | Show version number                                                                |         |

## Getting Help

You can get help for any command by adding the `--help` flag:

```bash
nx <command> --help
```
