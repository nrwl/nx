---
title: CLI Commands
description: Complete reference for all Nx CLI commands
---

# Nx CLI Commands

Nx provides a comprehensive set of CLI commands to help you manage your workspace. Below is a complete reference of all available commands.

## Available Commands

### `nx add`

Install a plugin and initialize it.

**Usage:**
```bash
nx add <packageSpecifier>
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx affected`

Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects. See https://nx.dev/ci/features/affected for more details.

**Usage:**
```bash
nx affected
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--base` | string | Base of the current branch (usually main) |  |
| `--batch` | boolean | Run task(s) in batches for executors which support batches | `false` |
| `--configuration` | string | This is the configuration to use when performing tasks on projects (alias: `-c`) |  |
| `--files` | string | Change the way Nx is calculating the affected command |  |
| `--graph` | string | Show the task graph of the command |  |
| `--head` | string | Latest commit of the current branch (usually HEAD) |  |
| `--nx-bail` | boolean | Stop command execution after the first failed task |  |
| `--nx-ignore-cycles` | boolean | Ignore cycles in the task graph |  |
| `--output-style` | string | Defines how Nx emits outputs tasks logs (choices: `dynamic`, `static`, `stream`, `stream-without-prefixes`) | `dynamic` |
| `--parallel` | number | Max number of parallel processes |  |
| `--runner` | string | This is the name of the tasks runner to use |  |
| `--skip-nx-cache` | boolean | Rerun the tasks even when the results are available in the cache |  |
| `--target` | string | Task to run for affected projects (alias: `-t`) |  |
| `--uncommitted` | boolean | Uncommitted changes |  |


### `nx connect`

Connect workspace to Nx Cloud.

**Aliases:** `connect-to-nx-cloud`

**Usage:**
```bash
nx connect
```

### `nx daemon`

Prints information about the Nx Daemon process or starts a daemon process.

**Usage:**
```bash
nx daemon
```

### `nx exec`

Executes any command as if it was a target on the project.

**Usage:**
```bash
nx exec
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--nx-bail` | boolean | Stop command execution after the first failed task |  |
| `--nx-ignore-cycles` | boolean | Ignore cycles in the task graph |  |


### `nx format`

Check for un-formatted files.

**Usage:**
```bash
nx format:check
```

### `nx generate`

Generate or update source code (e.g., nx generate @nx/js:lib mylib).

**Aliases:** `g`

**Usage:**
```bash
nx generate <generator> [_..]
```

### `nx graph`

Graph dependencies within workspace.

**Aliases:** `dep-graph`

**Usage:**
```bash
nx graph
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--base` | string | Base of the current branch (usually main) |  |
| `--files` | string | Change the way Nx is calculating the affected command |  |
| `--head` | string | Latest commit of the current branch (usually HEAD) |  |
| `--uncommitted` | boolean | Uncommitted changes |  |
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx import`

Import code and git history from another repository into this repository.

**Usage:**
```bash
nx import [sourceRepository] [destinationDirectory]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx init`

Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.

**Usage:**
```bash
nx init
```

### `nx list`

Lists installed plugins, capabilities of installed plugins and other available plugins.

**Usage:**
```bash
nx list [plugin]
```

### `nx login`

The Nx Cloud URL of the instance you are trying to connect to. If no positional argument is provided, this command will connect to https://cloud.nx.app.

**Usage:**
```bash
nx login [nxCloudUrl]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx logout`

Logout from Nx Cloud. This command is an alias for [`nx-cloud logout`](/ci/reference/nx-cloud-cli#npx-nxcloud-logout).

**Usage:**
```bash
nx logout
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx migrate`

Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.

**Usage:**
```bash
nx migrate [packageAndVersion]
```

### `nx new`

The new command

**Usage:**
```bash
nx new [_..]
```

### `nx register`

The register command

**Aliases:** `activate-powerpack`

**Usage:**
```bash
nx register [key]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx release`

Print the resolved nx release configuration that would be used for the current command and then exit.

**Usage:**
```bash
nx release
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


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

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx report`

Reports useful version numbers to copy into the Nx issue template.

**Usage:**
```bash
nx report
```

### `nx reset`

Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.

**Aliases:** `clear-cache`

**Usage:**
```bash
nx reset
```

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

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--batch` | boolean | Run task(s) in batches for executors which support batches | `false` |
| `--nx-bail` | boolean | Stop command execution after the first failed task |  |
| `--nx-ignore-cycles` | boolean | Ignore cycles in the task graph |  |


### `nx run-many`

Run target for multiple listed projects.

**Usage:**
```bash
nx run-many
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--batch` | boolean | Run task(s) in batches for executors which support batches | `false` |
| `--configuration` | string | This is the configuration to use when performing tasks on projects (alias: `-c`) |  |
| `--nx-bail` | boolean | Stop command execution after the first failed task |  |
| `--nx-ignore-cycles` | boolean | Ignore cycles in the task graph |  |
| `--output-style` | string | Defines how Nx emits outputs tasks logs (choices: `dynamic`, `static`, `stream`, `stream-without-prefixes`) | `dynamic` |
| `--target` | string | Task to run for affected projects (alias: `-t`) |  |


### `nx show`

Show information about the workspace (e.g., list of projects).

**Usage:**
```bash
nx show
```

### `nx sync`

Sync the workspace files by running all the sync generators.

**Usage:**
```bash
nx sync
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--verbose` | boolean | Enable verbose logging | `false` |


### `nx watch`

Watch for changes within projects, and execute commands.

**Usage:**
```bash
nx watch
```


## Getting Help

You can get help for any command by adding the `--help` flag:

```bash
nx <command> --help
```
