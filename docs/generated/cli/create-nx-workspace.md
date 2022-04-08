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

Type: boolean

Default: false

Show all prompts

### appName

Type: string

The name of the application when a preset with pregenerated app is selected

### cli

Type: string

Choices: [nx, angular]

CLI to power the Nx workspace

### defaultBase

Type: string

Default: main

Default base to use for new projects

### help

Type: boolean

Show help

### interactive

Type: boolean

Enable interactive mode with presets

### name

Type: string

Workspace name (e.g. org name)

### nxCloud

Type: boolean

Use Nx Cloud

### packageManager

Type: string

Choices: [npm, pnpm, yarn]

Default: npm

Package manager to use

### preset

Type: string

Choices: [apps, empty, core, npm, ts, web-components, angular, angular-nest, react, react-express, react-native, next, nest, express]

Customizes the initial content of your workspace. To build your own see https://nx.dev/nx-plugin/overview#preset

### style

Type: string

Style option to be used when a preset with pregenerated app is selected

### version

Type: boolean

Show version number
