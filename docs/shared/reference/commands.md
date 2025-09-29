---
title: Nx Commands
description: A comprehensive reference of all available Nx CLI commands for modifying code, running tasks, displaying information, and integrating with Nx Cloud.
---

# Nx Commands

The Nx CLI provides many commands. They are organized here into commands that:

- [Modify Code](#modify-code)
- [Run Tasks](#run-tasks)
- [Display Information](#display-information)
- [Integrate with Nx Cloud](#integrate-with-nx-cloud)

There is also a section for separate commands that can [create a new Nx workspace](#create-commands) for you.

{% callout type="note" title="Parsing Nx Commands" %}

If the command that you pass to Nx is not one of the keywords listed below, it will try to interpret the command as if it were a task. So Nx will parse your command in the following ways and execute the first syntax that is valid.

1. `nx [built-in-command] [...arguments]`
2. `nx [task-name-for-root-project] [...arguments]`
3. `nx [task-name] [project-name] [...arguments]`

{% /callout %}

## Modify Code

These commands modify your codebase in some way.

### init

Adds Nx to any type of workspace. It installs nx, creates an `nx.json` configuration file and optionally sets up remote caching.

```shell
nx init
```

{% cards cols="2" mdCols="4" smCols="2" %}

{% link-card title="nx init" type="API Reference" url="/reference/core-api/nx/documents/init" /%}
{% link-card title="Add to Existing Monorepo" type="Recipe" url="/recipes/adopting-nx/adding-to-monorepo" /%}
{% link-card title="Add to Any Project" type="Recipe" url="/recipes/adopting-nx/adding-to-existing-project" /%}
{% link-card title="Migrate from Angular CLI" type="Recipe" url="technologies/angular/migration/angular" /%}

{% /cards %}

### add

Install a plugin and initialize it.

```shell
nx add my-plugin
```

{% cards %}

{% link-card title="nx add" type="API Reference" url="/reference/core-api/nx/documents/add" /%}
{% link-card title="Plugin Registry" type="Reference" url="/plugin-registry" /%}

{% /cards %}

### generate

Runs a generator that creates and/or modifies files based on a generator from a plugin.

```shell
nx generate @nx/react:component libs/my-lib/src/lib/my-component
```

{% cards %}
{% link-card title="nx generate" type="API Reference" url="/reference/core-api/nx/documents/generate" /%}
{% link-card title="Generate Code" type="Feature" url="/features/generate-code" /%}
{% /cards %}

### migrate

Creates a migrations file or runs migrations from the migrations file.

```shell
nx migrate latest
nx migrate --run-migrations
```

{% cards %}
{% link-card title="nx migrate" type="API Reference" url="/reference/core-api/nx/documents/migrate" /%}
{% link-card title="Automate Updating Dependencies" type="Feature" url="/features/automate-updating-dependencies" /%}
{% /cards %}

### configure-ai-agents

Configures AI agent context files (like `AGENTS.md`, `CLAUDE.md` etc.) and configures the Nx MCP server. Prompts for individual agents to configure.

```shell
nx configure-ai-agents
nx configure-ai-agents --check
```

{% cards %}
{% link-card title="nx import" type="API Reference" url="/reference/core-api/nx/documents/configure-ai-agents" /%}
{% /cards %}

### import

Import code and git history from another repository into this repository.

```shell
nx import https://github.com/myorg/inventory-app.git apps/inventory
nx import ../inventory-app apps/inventory
```

{% cards %}
{% link-card title="nx import" type="API Reference" url="/reference/core-api/nx/documents/import" /%}
{% link-card title="Import an Existing Project into an Nx Workspace" type="Recipe" url="/recipes/adopting-nx/import-project" /%}
{% /cards %}

### repair

Repair any configuration that is no longer supported by Nx.

Specifically, this will run every migration within the nx package against the current repository. Doing so should fix any configuration details left behind if the repository was previously updated to a new Nx version without using nx migrate.

If your repository has only ever updated to newer versions of Nx with nx migrate, running nx repair should do nothing.

```shell
nx repair
```

{% cards %}
{% link-card title="nx repair" type="API Reference" url="/reference/core-api/nx/documents/repair" /%}
{% /cards %}

### sync

Run all sync generators

```shell
nx sync
nx sync:check
```

{% cards %}
{% link-card title="nx sync" type="API Reference" url="/reference/core-api/nx/documents/sync" /%}
{% link-card title="nx sync:check" type="API Reference" url="/reference/core-api/nx/documents/sync-check" /%}
{% link-card title="Sync Generators" type="Concept" url="/concepts/sync-generators" /%}
{% link-card title="Register a Sync Generator" type="Recipe" url="/extending-nx/recipes/create-sync-generator" /%}
{% /cards %}

### format

Overwrite un-formatted files or check for un-formatted files

```shell
nx format
nx format:check
```

{% cards %}
{% link-card title="nx format" type="API Reference" url="/reference/core-api/nx/documents/format-write" /%}
{% link-card title="nx format:check" type="API Reference" url="/reference/core-api/nx/documents/format-check" /%}
{% /cards %}

## Run Tasks

These commands run tasks on your code.

### run

Run a target for a project

```shell
nx run my-app:build
nx build my-app
```

{% cards %}
{% link-card title="nx run" type="API Reference" url="/reference/core-api/nx/documents/run" /%}
{% link-card title="Run Tasks" type="Feature" url="/features/run-tasks" /%}
{% /cards %}

### run-many

Run target for multiple listed projects

```shell
nx run-many --target=build
```

{% cards %}
{% link-card title="nx run-many" type="API Reference" url="/reference/core-api/nx/documents/run-many" /%}
{% link-card title="Run Tasks" type="Feature" url="/features/run-tasks" /%}
{% /cards %}

### affected

Run target for affected projects

```shell
nx affected --target=build
```

{% cards %}
{% link-card title="nx affected" type="API Reference" url="/reference/core-api/nx/documents/affected" /%}
{% link-card title="Run Only Tasks Affected by a PR" type="Feature" url="/ci/features/affected" /%}
{% /cards %}

### exec

Executes any command as if it was a target on the project

```json {% fileName="package.json" %}
{
  "scripts": {
    "build": "nx exec -- node ./my-custom-build.js"
  }
}
```

{% cards %}
{% link-card title="nx exec" type="API Reference" url="/reference/core-api/nx/documents/exec" /%}
{% link-card title="Run Root Level NPM Scripts with Nx" type="Recipe" url="/recipes/running-tasks/root-level-scripts#run-rootlevel-npm-scripts-with-nx" /%}
{% /cards %}

### watch

Watch for changes within projects, and execute commands

```shell
nx watch --projects=assets -- nx build assets
```

{% cards %}
{% link-card title="nx watch" type="API Reference" url="/reference/core-api/nx/documents/watch" /%}
{% link-card title="Workspace Watching" type="Recipe" url="/recipes/running-tasks/workspace-watching" /%}
{% /cards %}

### release

Orchestrate versioning and publishing of applications and libraries

```shell
nx release version
nx release changelog
nx release publish
```

{% cards %}
{% link-card title="nx release" type="API Reference" url="/reference/core-api/nx/documents/release" /%}
{% link-card title="Manage Releases" type="Feature" url="/features/manage-releases" /%}
{% /cards %}

### reset

Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.

```shell
nx reset
```

{% cards %}
{% link-card title="nx reset" type="API Reference" url="/reference/core-api/nx/documents/reset" /%}
{% /cards %}

## Display Information

### show

Show information about the workspace (e.g., list of projects)

```shell
nx show projects
nx show project my-app
```

{% cards %}
{% link-card title="nx show" type="API Reference" url="/reference/core-api/nx/documents/show" /%}
{% link-card title="Explore Projects in Your Workspace" type="Recipe" url="/features/explore-graph#explore-projects-in-your-workspace" /%}
{% /cards %}

### graph

Graph dependencies within workspace

```shell
nx graph
```

{% cards %}
{% link-card title="nx graph" type="API Reference" url="/reference/core-api/nx/documents/dep-graph" /%}
{% link-card title="Explore Your Workspace" type="Recipe" url="/features/explore-graph" /%}
{% /cards %}

### list

Lists installed plugins, capabilities of installed plugins and other available plugins.

```shell
nx list
nx list my-plugin
```

{% cards %}
{% link-card title="nx list" type="API Reference" url="/reference/core-api/nx/documents/list" /%}
{% /cards %}

### report

Reports useful version numbers to copy into the Nx issue template

```shell
nx report
```

{% cards %}
{% link-card title="nx report" type="API Reference" url="/reference/core-api/nx/documents/report" /%}
{% /cards %}

### daemon

Prints information about the Nx Daemon process or starts a daemon process

```shell
nx daemon
```

{% cards %}
{% link-card title="nx daemon" type="API Reference" url="/reference/core-api/nx/documents/daemon" /%}
{% link-card title="Nx Daemon" type="Concept" url="/concepts/nx-daemon" /%}
{% /cards %}

### mcp

Starts the Nx [MCP server](https://modelcontextprotocol.io/introduction) for exposing Nx tools to various AI systems (VSCode, Cursor, Claude, ...)

{% cards %}
{% link-card title="MCP" type="API Reference" url="/reference/core-api/nx/documents/mcp" /%}
{% link-card title="Enhance Your LLM" type="Feature" url="/features/enhance-AI" /%}
{% /cards %}

## Integrate with Nx Cloud

### connect

Connect an Nx workspace to Nx Cloud

```shell
nx connect
```

{% cards %}
{% link-card title="nx connect" type="API Reference" url="/reference/core-api/nx/documents/connect-to-nx-cloud" /%}
{% link-card title="Connect to Nx Cloud" type="Feature" url="/ci/recipes/set-up" /%}
{% /cards %}

### login

Login to Nx Cloud. This command is an alias for [`nx-cloud login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login).

```shell
nx login
```

{% cards %}
{% link-card title="nx login" type="API Reference" url="/reference/core-api/nx/documents/login" /%}
{% link-card title="Personal Access Tokens" type="Recipe" url="/ci/recipes/security/personal-access-tokens" /%}
{% /cards %}

### logout

Logout from Nx Cloud. This command is an alias for [`nx-cloud logout`](/ci/reference/nx-cloud-cli#npx-nxcloud-logout).

```shell
nx logout
```

{% cards %}
{% link-card title="nx logout" type="API Reference" url="/reference/core-api/nx/documents/logout" /%}
{% link-card title="Personal Access Tokens" type="Recipe" url="/ci/recipes/security/personal-access-tokens" /%}
{% /cards %}

### record

Records command execution for distributed task execution. This command is an alias for [`nx-cloud record`](/ci/reference/nx-cloud-cli#npx-nxcloud-record).

```shell
nx record -- nx run my-app:build
```

{% cards %}
{% link-card title="nx record" type="API Reference" url="/reference/core-api/nx/documents/record" /%}
{% link-card title="Distribute Task Execution" type="Feature" url="/ci/features/distribute-task-execution" /%}
{% /cards %}

### start-ci-run

Starts a new CI run for distributed task execution. This command is an alias for [`nx-cloud start-ci-run`](/ci/reference/nx-cloud-cli#npx-nxcloud-start-ci-run).

```shell
nx start-ci-run
```

{% cards %}
{% link-card title="nx start-ci-run" type="API Reference" url="/reference/core-api/nx/documents/start-ci-run" /%}
{% link-card title="Distribute Task Execution" type="Feature" url="/ci/features/distribute-task-execution" /%}
{% /cards %}

### fix-ci

Fixes CI failures with AI-powered suggestions. This command is an alias for [`nx-cloud fix-ci`](/ci/reference/nx-cloud-cli#npx-nxcloud-fix-ci).

```shell
nx fix-ci
```

{% cards %}
{% link-card title="nx fix-ci" type="API Reference" url="/reference/core-api/nx/documents/fix-ci" /%}
{% /cards %}

## Create Commands

### create-nx-workspace

Create a new Nx workspace

```shell
npx create-nx-workspace
```

{% cards %}
{% link-card title="create-nx-workspace" type="API Reference" url="/reference/core-api/nx/documents/create-nx-workspace" /%}
{% /cards %}

### create-nx-plugin

Create a new Nx workspace with a preset designed for writing an Nx plugin

```shell
npx create-nx-plugin
```

{% cards %}
{% link-card title="Extending Nx with Plugins" type="Concept" url="/extending-nx/intro/getting-started" /%}
{% /cards %}
