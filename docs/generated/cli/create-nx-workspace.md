---
title: 'create-nx-workspace - CLI command'
description: 'Create a new Nx workspace'
---

# create-nx-workspace

Create a new Nx workspace

## Usage

```bash
create-nx-workspace [name] [options]
```

Install `create-nx-workspace` globally to invoke the command directly, or use `npx create-nx-workspace`, `yarn create nx-workspace`, or `pnpx create-nx-workspace`.

## Options

### allPrompts

Type: `boolean`

Default: `false`

Show all prompts

### appName

Type: `string`

The name of the application when a preset with pregenerated app is selected

### ci

Type: `string`

Choices: [github, circleci, azure]

Generate a CI workflow file

### cli

Type: `string`

Choices: [nx, angular]

CLI to power the Nx workspace

### commit.email

Type: `string`

E-mail of the committer

### commit.message

Type: `string`

Default: `Initial commit`

Commit message

### commit.name

Type: `string`

Name of the committer

### defaultBase

Type: `string`

Default: `main`

Default base to use for new projects

### help

Type: `boolean`

Show help

### interactive

Type: `boolean`

Enable interactive mode with presets

### name

Type: `string`

Workspace name (e.g. org name)

### nxCloud

Type: `boolean`

Enable distributed caching to make your CI faster

### packageManager

Type: `string`

Choices: [npm, pnpm, yarn]

Default: `npm`

Package manager to use

### preset

Type: `string`

Customizes the initial content of your workspace. Default presets include: ["apps", "empty", "core", "npm", "ts", "web-components", "angular-monorepo", "angular-standalone", "react-monorepo", "react-standalone", "react-native", "expo", "next", "nest", "express", "react", "angular"]. To build your own see https://nx.dev/packages/nx-plugin#preset

### skipGit

Type: `boolean`

Default: `false`

Skip initializing a git repository.

### style

Type: `string`

Style option to be used when a preset with pregenerated app is selected

### version

Type: `boolean`

Show version number
