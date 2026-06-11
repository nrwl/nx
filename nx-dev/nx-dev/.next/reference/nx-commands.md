
The Nx command line has various subcommands and options to help you manage your Nx workspace and run tasks efficiently.
Below is a complete reference for all available commands and their options.
You can run nx --help to view all available options.

## `nx add`
Install a plugin and initialize it.

**Usage:**
```bash
nx add <packageSpecifier>
```

#### `nx add` Examples

Install the `@nx/react` package matching the installed version of the `nx` package and run its `@nx/react:init` generator:

```bash
nx add @nx/react
```

Install the latest version of the `non-core-nx-plugin` package and run its `non-core-nx-plugin:init` generator if available:

```bash
nx add non-core-nx-plugin
```

Install version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator:

```bash
nx add @nx/react@17.0.0
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--packageSpecifier` | string | The package name and optional version (e.g. `@nx/react` or `@nx/react@latest`) to install and initialize. If the version is not specified it will install the same version as the `nx` package for Nx core plugins or the latest version for other packages. |  |
| `--updatePackageScripts` | boolean | Update `package.json` scripts with inferred targets. Defaults to `true` when the package is a core Nx plugin. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx affected`
Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects. See https://nx.dev/ci/features/affected for more details.

**Usage:**
```bash
nx affected
```

#### `nx affected` Examples

Run custom target for all affected projects:

```bash
nx affected -t custom-target
```

Run tests in parallel:

```bash
nx affected -t test --parallel=5
```

Run lint, test, and build targets for affected projects. Requires Nx v15.4+:

```bash
nx affected -t lint test build
```

Run tests for all the projects affected by changing the index.ts file:

```bash
nx affected -t test --files=libs/mylib/src/index.ts
```

Run tests for all the projects affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected -t test --base=main --head=HEAD
```

Run tests for all the projects affected by the last commit on main:

```bash
nx affected -t test --base=main~1 --head=main
```

Run build for only projects with the tag `dotnet`:

```bash
nx affected -t=build --exclude='*,!tag:dotnet'
```

Use the currently executing project name in your command:

```bash
nx affected -t build --tag=$NX_TASK_TARGET_PROJECT:latest
```

Preview the task graph that Nx would run inside a webview:

```bash
nx affected -t=build --graph
```

Save the task graph to a file:

```bash
nx affected -t=build --graph=output.json
```

Print the task graph to the console:

```bash
nx affected -t=build --graph=stdout
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean |  **⚠️ Deprecated**: Use `nx run-many` instead |  |
| `--base` | string | Base of the current branch (usually main). |  |
| `--batch` | boolean | Run task(s) in batches for executors which support batches. |  |
| `--configuration`, `-c` | string | This is the configuration to use when performing tasks on projects. |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--excludeTaskDependencies` | boolean | Skips running dependent tasks first. | `false` |
| `--files` | string | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |  |
| `--graph` | string | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD). |  |
| `--help` | boolean | Show help |  |
| `--nxBail` | boolean | Stop command execution after the first failed task. |  |
| `--nxIgnoreCycles` | boolean | Ignore cycles in the task graph. | `false` |
| `--outputStyle` | string | Defines how Nx emits outputs tasks logs. **tui**: enables the Nx Terminal UI, recommended for local development environments. **dynamic-legacy**: use dynamic-legacy output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended for local development environments where tui is not supported. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. (choices: `dynamic-legacy`, `dynamic`, `tui`, `static`, `stream`, `stream-without-prefixes`) |  |
| `--parallel` | string | Max number of parallel processes [default is 3]. |  |
| `--runner` | string | This is the name of the tasks runner configured in nx.json. |  |
| `--skipNxCache`, `--disableNxCache` | boolean | Rerun the tasks even when the results are available in the cache. | `false` |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean | Disables the remote cache. | `false` |
| `--skipSync` | boolean | Skips running the sync generators associated with the tasks. | `false` |
| `--stdin` | boolean | Change the way Nx is calculating the affected command by providing directly changed files from stdin, one file per line. |  |
| `--targets`, `--target`, `-t` | string | Tasks to run for affected projects. |  |
| `--tui` | boolean | Enable or disable the Nx Terminal UI. |  |
| `--tuiAutoExit` | string | Whether or not to exit the TUI automatically after all tasks finish, and after how long. If set to `true`, the TUI will exit immediately. If set to `false` the TUI will not automatically exit. If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits. |  |
| `--uncommitted` | boolean | Uncommitted changes. |  |
| `--untracked` | boolean | Untracked changes. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx apply-locally`
Applies a self-healing CI fix locally. This command is an alias for `nx-cloud apply-locally`.

**Usage:**
```bash
nx apply-locally [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx configure-ai-agents`
Configure and update AI agent configurations for your workspace.

**Usage:**
```bash
nx configure-ai-agents
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--agents` | string | List of AI agents to set up. (choices: `claude`, `codex`, `copilot`, `cursor`, `gemini`, `opencode`) |  |
| `--check` | string | Check agent configurations. Use --check or --check=outdated to check only configured agents, or --check=all to include unconfigured/partial configurations. Does not make any changes. (choices: `outdated`, `all`) |  |
| `--help` | boolean | Show help |  |
| `--interactive` | boolean | When false disables interactive input prompts for options. | `true` |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx connect`
Connect workspace to Nx Cloud.

**Usage:**
```bash
nx connect
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--generateToken` | boolean | Explicitly asks for a token to be created, do not override existing tokens from Nx Cloud. |  |
| `--help` | boolean | Show help |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx daemon`
Prints information about the Nx Daemon process or starts a daemon process.

**Usage:**
```bash
nx daemon
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--start` | boolean | _No Description_ | `false` |
| `--stop` | boolean | _No Description_ | `false` |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx download-cloud-client`
Download the Nx Cloud client.

**Usage:**
```bash
nx download-cloud-client
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx fix-ci`
Fixes CI failures. This command is an alias for [`nx-cloud fix-ci`](/ci/reference/nx-cloud-cli#npx-nxcloud-fix-ci).

**Usage:**
```bash
nx fix-ci [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx format:check`
Check for un-formatted files.

**Usage:**
```bash
nx format:check
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean | Format all projects. |  |
| `--base` | string | Base of the current branch (usually main). |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--files` | string | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD). |  |
| `--help` | boolean | Show help |  |
| `--libs-and-apps` | boolean | Format only libraries and applications files. |  |
| `--projects` | string | Projects to format (comma/space delimited). |  |
| `--sort-root-tsconfig-paths` | boolean | Ensure the workspace's tsconfig compilerOptions.paths are sorted. Warning: This will cause comments in the tsconfig to be lost. The default value is "false" unless NX_FORMAT_SORT_TSCONFIG_PATHS is set to "true". |  |
| `--stdin` | boolean | Change the way Nx is calculating the affected command by providing directly changed files from stdin, one file per line. |  |
| `--uncommitted` | boolean | Uncommitted changes. |  |
| `--untracked` | boolean | Untracked changes. |  |
| `--version` | boolean | Show version number |  |


## `nx format:write`
Overwrite un-formatted files.

**Usage:**
```bash
nx format:write
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean | Format all projects. |  |
| `--base` | string | Base of the current branch (usually main). |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--files` | string | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD). |  |
| `--help` | boolean | Show help |  |
| `--libs-and-apps` | boolean | Format only libraries and applications files. |  |
| `--projects` | string | Projects to format (comma/space delimited). |  |
| `--sort-root-tsconfig-paths` | boolean | Ensure the workspace's tsconfig compilerOptions.paths are sorted. Warning: This will cause comments in the tsconfig to be lost. The default value is "false" unless NX_FORMAT_SORT_TSCONFIG_PATHS is set to "true". |  |
| `--stdin` | boolean | Change the way Nx is calculating the affected command by providing directly changed files from stdin, one file per line. |  |
| `--uncommitted` | boolean | Uncommitted changes. |  |
| `--untracked` | boolean | Untracked changes. |  |
| `--version` | boolean | Show version number |  |


## `nx graph`
Graph dependencies within workspace.

**Usage:**
```bash
nx graph
```

#### `nx graph` Examples

Open the project graph of the workspace in the browser:

```bash
nx graph
```

Save the project graph into a json file:

```bash
nx graph --file=output.json
```

Generate a static website with project graph into an html file, accompanied by an asset folder called static:

```bash
nx graph --file=output.html
```

Print the project graph as JSON to the console:

```bash
nx graph --print
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main:

```bash
nx graph --focus=todos-feature-main
```

Exclude project-one and project-two from the project graph:

```bash
nx graph --exclude=project-one,project-two
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two:

```bash
nx graph --focus=todos-feature-main --exclude=project-one,project-two
```

Watch for changes to project graph and update in-browser:

```bash
nx graph --watch
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--affected` | boolean | Highlight affected projects. |  |
| `--base` | string | Base of the current branch (usually main). |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--file` | string | Output file (e.g. --file=output.json or --file=dep-graph.html). |  |
| `--files` | string | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |  |
| `--focus` | string | Use to show the project graph for a particular project and every node that is either an ancestor or a descendant. |  |
| `--groupByFolder` | boolean | Group projects by folder in the project graph. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD). |  |
| `--help` | boolean | Show help |  |
| `--host` | string | Bind the project graph server to a specific ip address. |  |
| `--open` | boolean | Open the project graph in the browser. | `true` |
| `--port` | number | Bind the project graph server to a specific port. |  |
| `--print` | boolean | Print the project graph to stdout in the terminal. |  |
| `--stdin` | boolean | Change the way Nx is calculating the affected command by providing directly changed files from stdin, one file per line. |  |
| `--targets` | string | The target to show tasks for in the task graph. |  |
| `--uncommitted` | boolean | Uncommitted changes. |  |
| `--untracked` | boolean | Untracked changes. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |
| `--view` | string | Choose whether to view the projects or task graph. (choices: `projects`, `tasks`) | `projects` |
| `--watch` | boolean | Watch for changes to project graph and update in-browser. | `true` |


## `nx import`
Import code and git history from another repository into this repository.

**Usage:**
```bash
nx import [sourceRepository] [destinationDirectory]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--depth` | number | The depth to clone the source repository (limit this for faster git clone). |  |
| `--destinationDirectory`, `--destination` | string | The directory in the current workspace to import into. |  |
| `--help` | boolean | Show help |  |
| `--interactive` | boolean | Interactive mode. | `true` |
| `--plugins` | string | Plugins to install after import: "skip" for none, "all" for all detected, or comma-separated list (e.g., @nx/vite,@nx/jest). |  |
| `--ref` | string | The branch from the source repository to import. |  |
| `--sourceDirectory`, `--source` | string | The directory in the source repository to import from. |  |
| `--sourceRepository` | string | The remote URL or local path of the source repository to import. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx init`
Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.

**Usage:**
```bash
nx init
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--aiAgents` | string | List of AI agents to set up. (choices: `claude`, `codex`, `copilot`, `cursor`, `gemini`, `opencode`) |  |
| `--cacheable` | string | Comma-separated list of cacheable operations (e.g., build,test,lint). |  |
| `--help` | boolean | Show help |  |
| `--interactive` | boolean | When false disables interactive input prompts for options. | `true` |
| `--nxCloud` | boolean | Set up distributed caching with Nx Cloud. |  |
| `--plugins` | string | Plugins to install: "skip" for none, "all" for all detected, or comma-separated list (e.g., @nx/vite,@nx/jest). |  |
| `--useDotNxInstallation` | boolean | Initialize an Nx workspace setup in the .nx directory of the current repository. | `false` |
| `--version` | boolean | Show version number |  |


## `nx list`
Lists installed plugins, capabilities of installed plugins and other available plugins.

**Usage:**
```bash
nx list [plugin]
```

#### `nx list` Examples

List the plugins installed in the current workspace:

```bash
nx list
```

List the generators and executors available in the `@nx/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace):

```bash
nx list @nx/web
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--json` | boolean | Output JSON. |  |
| `--plugin` | string | The name of an installed plugin to query. |  |
| `--version` | boolean | Show version number |  |


## `nx login`
Login to Nx Cloud. This command is an alias for `nx-cloud login`.

**Usage:**
```bash
nx login [nxCloudUrl]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--nxCloudUrl` | string | The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to your configured Nx Cloud instance by default. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx logout`
Logout from Nx Cloud. This command is an alias for `nx-cloud logout`.

**Usage:**
```bash
nx logout
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx mcp`
Starts the Nx MCP server.

**Usage:**
```bash
nx mcp
```

## `nx migrate`
Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.

**Usage:**
```bash
nx migrate [packageAndVersion]
```

#### `nx migrate` Examples

Update all Nx plugins to "latest". This will generate migrations.json:

```bash
nx migrate latest
```

Update all Nx plugins to "9.0.0". This will generate migrations.json:

```bash
nx migrate 9.0.0
```

Update @nx/workspace and generate the list of migrations starting with version 8.0.0 of @nx/workspace and @nx/node, regardless of what is installed locally:

```bash
nx migrate @nx/workspace@9.0.0 --from="@nx/workspace@8.0.0,@nx/node@8.0.0"
```

Update @nx/workspace to "9.0.0". If it tries to update @nx/react or @nx/angular, use version "9.0.1":

```bash
nx migrate @nx/workspace@9.0.0 --to="@nx/react@9.0.1,@nx/angular@9.0.1"
```

Update another-package to "12.0.0". This will update other packages and will generate migrations.json file:

```bash
nx migrate another-package@12.0.0
```

Collect package updates and migrations in interactive mode. In this mode, the user will be prompted whether to apply any optional package update and migration:

```bash
nx migrate latest --interactive
```

Collect package updates and migrations starting with version 14.5.0 of "nx" (and Nx first-party plugins), regardless of what is installed locally, while excluding migrations that should have been applied on previous updates:

```bash
nx migrate latest --from=nx@14.5.0 --exclude-applied-migrations
```

Run migrations from the provided migrations.json file. You can modify migrations.json and run this command many times:

```bash
nx migrate --run-migrations=migrations.json
```

Create a dedicated commit for each successfully completed migration. You can customize the prefix used for each commit by additionally setting --commit-prefix="PREFIX_HERE ":

```bash
nx migrate --run-migrations --create-commits
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--commitPrefix` | string | Commit prefix to apply to the commit for each migration, when --create-commits is enabled. | `chore: [nx migration] ` |
| `--createCommits`, `-C` | boolean | Automatically create a git commit after each migration runs. | `false` |
| `--excludeAppliedMigrations` | boolean | Exclude migrations that should have been applied on previous updates. To be used with --from. | `false` |
| `--from` | string | Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nx/react@16.0.0,@nx/js@16.0.0"). |  |
| `--help` | boolean | Show help |  |
| `--ifExists` | boolean | Run migrations only if the migrations file exists, if not continues successfully. | `false` |
| `--interactive` | boolean | Enable prompts to confirm whether to collect optional package updates and migrations. |  |
| `--packageAndVersion` | string | The target package and version (e.g, @nx/workspace@16.0.0). |  |
| `--runMigrations` | string | Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json). |  |
| `--skipInstall` | boolean | Skip installing packages before running migrations. Useful when the installation needs to be performed manually (e.g., to resolve peer dependency conflicts). | `false` |
| `--to` | string | Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nx/react@16.0.0,@nx/js@16.0.0"). |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx record`
Records a command execution for distributed task execution. This command is an alias for [`nx-cloud record`](/ci/reference/nx-cloud-cli#npx-nxcloud-record).

**Usage:**
```bash
nx record [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx release`
Orchestrate versioning and publishing of applications and libraries.

**Usage:**
```bash
nx release
```

#### Shared Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--dry-run`, `-d` | boolean | Preview the changes without updating files/creating releases. | `false` |
| `--groups`, `--group`, `-g` | string | One or more release groups to target with the current command. |  |
| `--help` | boolean | Show help |  |
| `--printConfig` | string | Print the resolved nx release configuration that would be used for the current command and then exit. |  |
| `--projects`, `-p` | string | Projects to run. (comma/space delimited project names and/or patterns). |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


### `nx release changelog`
Generate a changelog for one or more projects, and optionally push to Github.

**Usage:**
```bash
nx release changelog [version]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--first-release` | boolean | Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running. |  |
| `--from` | string | The git reference to use as the start of the changelog. If not set it will attempt to resolve the latest tag and use that. |  |
| `--git-commit` | boolean | Whether or not to automatically commit the changes made by this command. |  |
| `--git-commit-args` | string | Additional arguments (added after the --message argument, which may or may not be customized with --git-commit-message) to pass to the `git commit` command invoked behind the scenes. |  |
| `--git-commit-message` | string | Custom git commit message to use when committing the changes made by this command. {version} will be dynamically interpolated when performing fixed releases, interpolated tags will be appended to the commit body when performing independent releases. |  |
| `--git-push` | boolean | Whether or not to automatically push the changes made by this command to the remote git repository. |  |
| `--git-push-args` | string | Additional arguments to pass to the `git push` command invoked behind the scenes. |  |
| `--git-remote` | string | Alternate git remote to push commits and tags to (can be useful for testing). | `origin` |
| `--git-tag` | boolean | Whether or not to automatically tag the changes made by this command. |  |
| `--git-tag-args` | string | Additional arguments to pass to the `git tag` command invoked behind the scenes. |  |
| `--git-tag-message` | string | Custom git tag message to use when tagging the changes made by this command. This defaults to be the same value as the tag itself. |  |
| `--help` | boolean | Show help |  |
| `--interactive`, `-i` | string | Interactively modify changelog markdown contents in your code editor before applying the changes. You can set it to be interactive for all changelogs, or only the workspace level, or only the project level. (choices: `all`, `workspace`, `projects`) |  |
| `--replace-existing-contents` | boolean | Whether to overwrite the existing changelog contents instead of prepending to them. | `false` |
| `--resolve-version-plans` | string | How to resolve version plans for changelog generation, defaults to resolving all version plan files available on disk. (choices: `all`, `using-from-and-to`) | `all` |
| `--stage-changes` | boolean | Whether or not to stage the changes made by this command. Always treated as true if git-commit is true. |  |
| `--to` | string | The git reference to use as the end of the changelog. | `HEAD` |
| `--version` | string | The version to create a Github release and changelog for. |  |


### `nx release plan`
Create a version plan file to specify the desired semver bump for one or more projects or groups, as well as the relevant changelog entry.

**Usage:**
```bash
nx release plan [bump]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--base` | string | Base of the current branch (usually main). |  |
| `--bump` | string | Semver keyword to use for the selected release group. (choices: `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`) |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--files` | string | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD). |  |
| `--help` | boolean | Show help |  |
| `--message`, `-m` | string | Custom message to use for the changelog entry. |  |
| `--onlyTouched` | boolean | Only include projects that have been affected by the current changes. | `true` |
| `--stdin` | boolean | Change the way Nx is calculating the affected command by providing directly changed files from stdin, one file per line. |  |
| `--uncommitted` | boolean | Uncommitted changes. |  |
| `--untracked` | boolean | Untracked changes. |  |
| `--version` | boolean | Show version number |  |


### `nx release plan:check`
Ensure that all touched projects have an applicable version plan created for them.

**Usage:**
```bash
nx release plan:check
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--base` | string | Base of the current branch (usually main). |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--files` | string | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD). |  |
| `--help` | boolean | Show help |  |
| `--stdin` | boolean | Change the way Nx is calculating the affected command by providing directly changed files from stdin, one file per line. |  |
| `--uncommitted` | boolean | Uncommitted changes. |  |
| `--untracked` | boolean | Untracked changes. |  |
| `--version` | boolean | Show version number |  |


### `nx release publish`
Publish a versioned project to a registry.

**Usage:**
```bash
nx release publish
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--access` | string | Overrides the access level of the published package. Unscoped packages cannot be set to restricted. See the npm publish documentation for more information. (choices: `public`, `restricted`) |  |
| `--all` | boolean | [deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required. | `true` |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--excludeTaskDependencies` | boolean | Skips running dependent tasks first. | `false` |
| `--first-release` | boolean | Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running. |  |
| `--graph` | string | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal. |  |
| `--help` | boolean | Show help |  |
| `--nxBail` | boolean | Stop command execution after the first failed task. |  |
| `--nxIgnoreCycles` | boolean | Ignore cycles in the task graph. | `false` |
| `--otp` | number | A one-time password for publishing to a registry that requires 2FA. |  |
| `--outputStyle` | string | Defines how Nx emits outputs tasks logs. **tui**: enables the Nx Terminal UI, recommended for local development environments. **dynamic-legacy**: use dynamic-legacy output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended for local development environments where tui is not supported. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. (choices: `dynamic-legacy`, `dynamic`, `tui`, `static`, `stream`, `stream-without-prefixes`) |  |
| `--parallel` | string | Max number of parallel processes [default is 3]. |  |
| `--projects`, `-p` | string | Projects to run. (comma/space delimited project names and/or patterns). |  |
| `--registry` | string | The registry to publish to. |  |
| `--runner` | string | This is the name of the tasks runner configured in nx.json. |  |
| `--skipNxCache`, `--disableNxCache` | boolean | Rerun the tasks even when the results are available in the cache. | `false` |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean | Disables the remote cache. | `false` |
| `--skipSync` | boolean | Skips running the sync generators associated with the tasks. | `false` |
| `--tag` | string | The distribution tag to apply to the published package. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


### `nx release version`
Create a version and release for one or more applications and libraries.

**Usage:**
```bash
nx release version [specifier]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--dockerVersion` | string | Exact docker version to use, bypassing the version scheme logic. Warning: Docker support is experimental. Breaking changes may occur and not adhere to semver versioning. |  |
| `--dockerVersionScheme` | string | Exact docker version scheme to apply to the selected release group. Warning: Docker support is experimental. Breaking changes may occur and not adhere to semver versioning. |  |
| `--first-release` | boolean | Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running. |  |
| `--git-commit` | boolean | Whether or not to automatically commit the changes made by this command. |  |
| `--git-commit-args` | string | Additional arguments (added after the --message argument, which may or may not be customized with --git-commit-message) to pass to the `git commit` command invoked behind the scenes. |  |
| `--git-commit-message` | string | Custom git commit message to use when committing the changes made by this command. {version} will be dynamically interpolated when performing fixed releases, interpolated tags will be appended to the commit body when performing independent releases. |  |
| `--git-push` | boolean | Whether or not to automatically push the changes made by this command to the remote git repository. |  |
| `--git-push-args` | string | Additional arguments to pass to the `git push` command invoked behind the scenes. |  |
| `--git-remote` | string | Alternate git remote to push commits and tags to (can be useful for testing). | `origin` |
| `--git-tag` | boolean | Whether or not to automatically tag the changes made by this command. |  |
| `--git-tag-args` | string | Additional arguments to pass to the `git tag` command invoked behind the scenes. |  |
| `--git-tag-message` | string | Custom git tag message to use when tagging the changes made by this command. This defaults to be the same value as the tag itself. |  |
| `--help` | boolean | Show help |  |
| `--preid` | string | The optional prerelease identifier to apply to the version. This will only be applied in the case that the specifier argument has been set to `prerelease` OR when conventional commits are enabled, in which case it will modify the resolved specifier from conventional commits to be its prerelease equivalent. E.g. minor -> preminor. | `` |
| `--specifier` | string | Exact version or semver keyword to apply to the selected release group. |  |
| `--stage-changes` | boolean | Whether or not to stage the changes made by this command. Always treated as true if git-commit is true. |  |
| `--version` | boolean | Show version number |  |


## `nx repair`
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

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx report`
Reports useful version numbers to copy into the Nx issue template.

**Usage:**
```bash
nx report
```

## `nx reset`
Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.

**Usage:**
```bash
nx reset
```

#### `nx reset` Examples

Clears the internal state of the daemon and metadata that Nx is tracking. Helpful if you are getting strange errors and want to start fresh:

```bash
nx reset
```

Clears the Nx Cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache:

```bash
nx reset --only-cache
```

Stops the Nx Daemon, it will be restarted fresh when the next Nx command is run.:

```bash
nx reset --only-daemon
```

Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc):

```bash
nx reset --only-workspace-data
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--onlyCache` | boolean | Clears the Nx cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache. |  |
| `--onlyCloud` | boolean | Resets the Nx Cloud client. NOTE: Does not clear the remote cache. |  |
| `--onlyDaemon` | boolean | Stops the Nx Daemon and clears its workspace data, it will be restarted fresh when the next Nx command is run. |  |
| `--onlyWorkspaceData` | boolean | Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc). |  |
| `--version` | boolean | Show version number |  |


## `nx run`
Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.

**Usage:**
```bash
nx run [project][:target][:configuration] [_..]
```

#### `nx run` Examples

Run the target build for the myapp project:

```bash
nx run myapp:build
```

Run the target build for the myapp project, with production configuration:

```bash
nx run myapp:build:production
```

Preview the task graph that Nx would run inside a webview:

```bash
nx run myapp:build --graph
```

Save the task graph to a file:

```bash
nx run myapp:build --graph=output.json
```

Print the task graph to the console:

```bash
nx run myapp:build --graph=stdout
```

Run's a target named build:test for the myapp project. Note the quotes around the target name to prevent "test" from being considered a configuration:

```bash
nx run myapp:"build:test"
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--batch` | boolean | Run task(s) in batches for executors which support batches. |  |
| `--configuration`, `-c` | string | This is the configuration to use when performing tasks on projects. |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--excludeTaskDependencies` | boolean | Skips running dependent tasks first. | `false` |
| `--graph` | string | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal. |  |
| `--nxBail` | boolean | Stop command execution after the first failed task. |  |
| `--nxIgnoreCycles` | boolean | Ignore cycles in the task graph. | `false` |
| `--outputStyle` | string | Defines how Nx emits outputs tasks logs. **tui**: enables the Nx Terminal UI, recommended for local development environments. **dynamic-legacy**: use dynamic-legacy output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended for local development environments where tui is not supported. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. (choices: `tui`, `dynamic`, `dynamic-legacy`, `static`, `stream`, `stream-without-prefixes`) |  |
| `--parallel` | string | Max number of parallel processes [default is 3]. |  |
| `--project`, `-p` | string | Target project. |  |
| `--runner` | string | This is the name of the tasks runner configured in nx.json. |  |
| `--skipNxCache`, `--disableNxCache` | boolean | Rerun the tasks even when the results are available in the cache. | `false` |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean | Disables the remote cache. | `false` |
| `--skipSync` | boolean | Skips running the sync generators associated with the tasks. | `false` |
| `--target`, `-t` | string | Target to run. Useful when the target name contains a colon, which conflicts with the positional `project:target:configuration` form. |  |
| `--tui` | boolean | Enable or disable the Nx Terminal UI. |  |
| `--tuiAutoExit` | string | Whether or not to exit the TUI automatically after all tasks finish, and after how long. If set to `true`, the TUI will exit immediately. If set to `false` the TUI will not automatically exit. If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx run-many`
Run target for multiple listed projects.

**Usage:**
```bash
nx run-many
```

#### `nx run-many` Examples

Test all projects:

```bash
nx run-many -t test
```

Test proj1 and proj2 in parallel:

```bash
nx run-many -t test -p proj1 proj2
```

Test proj1 and proj2 in parallel using 5 workers:

```bash
nx run-many -t test -p proj1 proj2 --parallel=5
```

Test proj1 and proj2 in sequence:

```bash
nx run-many -t test -p proj1 proj2 --parallel=false
```

Test all projects ending with `*-app` except `excluded-app`.  Note: your shell may require you to escape the `*` like this: `\*`:

```bash
nx run-many -t test --projects=*-app --exclude excluded-app
```

Test all projects with tags starting with `api-`.  Note: your shell may require you to escape the `*` like this: `\*`:

```bash
nx run-many -t test --projects=tag:api-*
```

Test all projects with a `type:ui` tag:

```bash
nx run-many -t test --projects=tag:type:ui
```

Test all projects with a `type:feature` or `type:ui` tag:

```bash
nx run-many -t test --projects=tag:type:feature,tag:type:ui
```

Run lint, test, and build targets for all projects. Requires Nx v15.4+:

```bash
nx run-many --targets=lint,test,build
```

Preview the task graph that Nx would run inside a webview:

```bash
nx run-many -t=build --graph
```

Save the task graph to a file:

```bash
nx run-many -t=build --graph=output.json
```

Print the task graph to the console:

```bash
nx run-many -t=build --graph=stdout
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean | [deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required. | `true` |
| `--batch` | boolean | Run task(s) in batches for executors which support batches. |  |
| `--configuration`, `-c` | string | This is the configuration to use when performing tasks on projects. |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--excludeTaskDependencies` | boolean | Skips running dependent tasks first. | `false` |
| `--graph` | string | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal. |  |
| `--help` | boolean | Show help |  |
| `--nxBail` | boolean | Stop command execution after the first failed task. |  |
| `--nxIgnoreCycles` | boolean | Ignore cycles in the task graph. | `false` |
| `--outputStyle` | string | Defines how Nx emits outputs tasks logs. **tui**: enables the Nx Terminal UI, recommended for local development environments. **dynamic-legacy**: use dynamic-legacy output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended for local development environments where tui is not supported. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. (choices: `dynamic-legacy`, `dynamic`, `tui`, `static`, `stream`, `stream-without-prefixes`) |  |
| `--parallel` | string | Max number of parallel processes [default is 3]. |  |
| `--projects`, `-p` | string | Projects to run. (comma/space delimited project names and/or patterns). |  |
| `--runner` | string | This is the name of the tasks runner configured in nx.json. |  |
| `--skipNxCache`, `--disableNxCache` | boolean | Rerun the tasks even when the results are available in the cache. | `false` |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean | Disables the remote cache. | `false` |
| `--skipSync` | boolean | Skips running the sync generators associated with the tasks. | `false` |
| `--targets`, `--target`, `-t` | string | Tasks to run for affected projects. |  |
| `--tui` | boolean | Enable or disable the Nx Terminal UI. |  |
| `--tuiAutoExit` | string | Whether or not to exit the TUI automatically after all tasks finish, and after how long. If set to `true`, the TUI will exit immediately. If set to `false` the TUI will not automatically exit. If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx show`
Show information about the workspace (e.g., list of projects).

**Usage:**
```bash
nx show
```

#### `nx show` Examples

Show all projects in the workspace:

```bash
nx show projects
```

Show all projects with names starting with "api-". The "projects" option is useful to see which projects would be selected by run-many:

```bash
nx show projects --projects api-*
```

Show all projects with a tag starting with "ui-". The "projects" option is useful to see which projects would be selected by run-many:

```bash
nx show projects --projects tag:ui-*
```

Show all projects with a serve target:

```bash
nx show projects --with-target serve
```

Show affected projects in the workspace:

```bash
nx show projects --affected
```

Show affected apps in the workspace:

```bash
nx show projects --affected --type app
```

Show affected projects in the workspace, excluding end-to-end projects:

```bash
nx show projects --affected --exclude=*-e2e
```

If in an interactive terminal, opens the project detail view. If not in an interactive terminal, defaults to JSON:

```bash
nx show project my-app
```

Show detailed information about "my-app" in a json format:

```bash
nx show project my-app --json
```

Show information about "my-app" in a human readable format:

```bash
nx show project my-app --json false
```

Opens a web browser to explore the configuration of "my-app":

```bash
nx show project my-app --web
```

Prints the specified + inferred configuration for `my-app:build`:

```bash
nx show target my-app:build
```

Prints the resolved inputs for `my-app:build`:

```bash
nx show target my-app:build inputs
```

Checks if `packages/my-app/index.html` is an input for `my-app:build`:

```bash
nx show target my-app:build inputs --check packages/my-app/index.html
```

Prints the outputs detected on disk for `my-app:build`:

```bash
nx show target my-app:build outputs
```

Checks if `packages/my-app/dist/index.html` is an output for `my-app:build`:

```bash
nx show target my-app:build outputs --check packages/my-app/dist/index.html
```


#### Shared Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--json` | boolean | Output JSON. |  |
| `--version` | boolean | Show version number |  |


### `nx show project`
Shows resolved project configuration for a given project. If run within a project directory and no project name is provided, the project is inferred from the current working directory.

**Usage:**
```bash
nx show project [projectName]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--open` | boolean | Set to false to prevent the browser from opening when using --web. |  |
| `--projectName`, `-p` | string | The project to show. If not provided, infers the project from the current working directory. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |
| `--web` | boolean | Show project details in the browser. (default when interactive). |  |


### `nx show projects`
Show a list of projects in the workspace.

**Usage:**
```bash
nx show projects
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--affected` | boolean | Show only affected projects. |  |
| `--base` | string | Base of the current branch (usually main). |  |
| `--exclude` | string | Exclude certain projects from being processed. |  |
| `--files` | string | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD). |  |
| `--help` | boolean | Show help |  |
| `--projects`, `-p` | string | Show only projects that match a given pattern. |  |
| `--sep` | string | Outputs projects with the specified seperator. |  |
| `--stdin` | boolean | Change the way Nx is calculating the affected command by providing directly changed files from stdin, one file per line. |  |
| `--type` | string | Select only projects of the given type. (choices: `app`, `lib`, `e2e`) |  |
| `--uncommitted` | boolean | Uncommitted changes. |  |
| `--untracked` | boolean | Untracked changes. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |
| `--withTarget`, `-t` | string | Show only projects that have a specific target. |  |


### `nx show target`

**Requires Nx 22.6+**

Shows resolved target configuration for a given project target. Use subcommands to inspect inputs or outputs.

**Usage:**
```bash
nx show target
```

#### Shared Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--version` | boolean | Show version number |  |


### `nx show target inputs`
List resolved input files for a target.

**Usage:**
```bash
nx show target inputs [target]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--check` | string | Check whether a set of values are an input for the target. Accepts a file path, environment variable name, runtime command, or external dependency. |  |
| `--help` | boolean | Show help |  |
| `--target` | string | The target to inspect, in the format project:target or just target. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


### `nx show target outputs`
List resolved output paths for a target.

**Usage:**
```bash
nx show target outputs [target]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--check` | string | Check whether a set of files is an output for the target. Accepts a workspace-relative path. |  |
| `--configuration`, `-c` | string | The configuration to inspect. |  |
| `--help` | boolean | Show help |  |
| `--target` | string | The target to inspect, in the format project:target or just target. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx start-agent`
Starts a new agent for distributed task execution. This command is an alias for [`nx-cloud start-agent`](/docs/reference/nx-cloud-cli).

**Usage:**
```bash
nx start-agent [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx start-ci-run`
Starts a new CI run for distributed task execution. This command is an alias for [`nx-cloud start-ci-run`](/docs/reference/nx-cloud-cli#npx-nxcloud-start-ci-run).

**Usage:**
```bash
nx start-ci-run [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx stop-all-agents`
Terminates all dedicated agents associated with this CI pipeline execution. This command is an alias for [`nx-cloud stop-all-agents`](/docs/reference/nx-cloud-cli#nx-cloud-stop-all-agents).

**Usage:**
```bash
nx stop-all-agents [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help. |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx sync`
Sync the workspace files by running all the sync generators.

**Usage:**
```bash
nx sync
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx sync:check`
Check that no changes are required after running all sync generators.

**Usage:**
```bash
nx sync:check
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--help` | boolean | Show help |  |
| `--verbose` | boolean | Prints additional information about the commands (e.g., stack traces). |  |
| `--version` | boolean | Show version number |  |


## `nx view-logs`
Enables you to view and interact with the logs via the advanced analytic UI from Nx Cloud to help you debug your issue. To do this, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details. Only the metrics are uploaded, not the artefacts.

**Usage:**
```bash
nx view-logs
```

## `nx watch`
Watch for changes within projects, and execute commands.

**Usage:**
```bash
nx watch
```

#### `nx watch` Examples

Watch the "app" project and echo the project name and the files that changed:

```bash
nx watch --projects=app -- echo \$NX_PROJECT_NAME \$NX_FILE_CHANGES
```

Watch "app1" and "app2" and echo the project name whenever a specified project or its dependencies change:

```bash
nx watch --projects=app1,app2 --includeDependentProjects -- echo \$NX_PROJECT_NAME
```

Watch all projects (including newly created projects) in the workspace:

```bash
nx watch --all -- echo \$NX_PROJECT_NAME
```


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean | Watch all projects. |  |
| `--help` | boolean | Show help |  |
| `--includeDependentProjects`, `-d` | boolean | When watching selected projects, include dependent projects as well. |  |
| `--initialRun`, `-i` | boolean | Run the command once before watching for changes. | `false` |
| `--projects`, `-p` | string | Projects to watch (comma/space delimited). |  |
| `--verbose` | boolean | Run watch mode in verbose mode, where commands are logged before execution. |  |
| `--version` | boolean | Show version number |  |



## Getting Help

You can get help for any command by adding the `--help` flag:

```bash
nx <command> --help
```
