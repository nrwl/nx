---
title: CLI Commands
description: Complete reference for all Nx CLI commands
---

# Nx CLI Commands

Nx provides a comprehensive set of CLI commands to help you manage your workspace. Below is a complete reference of all available commands.

## Available Commands

### [`nx add`](./cli-add)

Install a plugin and initialize it.

```bash
nx add <packageSpecifier>
```

### [`nx affected`](./cli-affected)

Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects. See https://nx.dev/ci/features/affected for more details.

```bash
nx affected
```

### [`nx connect`](./cli-connect)

Connect workspace to Nx Cloud.

```bash
nx connect
```

### [`nx daemon`](./cli-daemon)

Prints information about the Nx Daemon process or starts a daemon process.

```bash
nx daemon
```

### [`nx exec`](./cli-exec)

Executes any command as if it was a target on the project.

```bash
nx exec
```

### [`nx format`](./cli-format)

Check for un-formatted files.

```bash
nx format:check
```

### [`nx generate`](./cli-generate)

Generate or update source code (e.g., nx generate @nx/js:lib mylib).

```bash
nx generate <generator> [_..]
```

### [`nx graph`](./cli-graph)

Graph dependencies within workspace.

```bash
nx graph
```

### [`nx import`](./cli-import)

Import code and git history from another repository into this repository.

```bash
nx import [sourceRepository] [destinationDirectory]
```

### [`nx init`](./cli-init)

Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.

```bash
nx init
```

### [`nx list`](./cli-list)

Lists installed plugins, capabilities of installed plugins and other available plugins.

```bash
nx list [plugin]
```

### [`nx login`](./cli-login)

Login to Nx Cloud. This command is an alias for [

```bash
nx login [nxCloudUrl]
```

### [`nx logout`](./cli-logout)

Logout from Nx Cloud. This command is an alias for [

```bash
nx logout
```

### [`nx migrate`](./cli-migrate)

Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.

```bash
nx migrate [packageAndVersion]
```

### [`nx new`](./cli-new)

The folder where the new workspace is going to be created.

```bash
nx new [_..]
```

### [`nx register`](./cli-register)

The register command

```bash
nx register [key]
```

### [`nx release`](./cli-release)

Orchestrate versioning and publishing of applications and libraries.

```bash
nx release
```

### [`nx repair`](./cli-repair)

Repair any configuration that is no longer supported by Nx.

    Specifically, this will run every migration within the \

```bash
nx repair
```

### [`nx report`](./cli-report)

Reports useful version numbers to copy into the Nx issue template.

```bash
nx report
```

### [`nx reset`](./cli-reset)

Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.

```bash
nx reset
```

### [`nx run`](./cli-run)

Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.

```bash
nx run [project][:target][:configuration] [_..]
```

### [`nx run-many`](./cli-run-many)

Run target for multiple listed projects.

```bash
nx run-many
```

### [`nx show`](./cli-show)

Show information about the workspace (e.g., list of projects).

```bash
nx show
```

### [`nx sync`](./cli-sync)

Sync the workspace files by running all the sync generators.

```bash
nx sync
```

### [`nx watch`](./cli-watch)

Watch for changes within projects, and execute commands.

```bash
nx watch
```


## Getting Help

You can get help for any command by adding the `--help` flag:

```bash
nx <command> --help
```
