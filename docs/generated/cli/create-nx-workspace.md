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

_boolean_

Default: false

Show all prompts

### appName

_string_

The name of the application when a preset with pregenerated app is selected

### cli

_string_

Choices: ["nx", "angular"]

CLI to power the Nx workspace

### defaultBase

_string_

Default: main

Default base to use for new projects

### help

_boolean_

Show help

### interactive

_boolean_

Enable interactive mode with presets

### name

_string_

Workspace name (e.g. org name)

### nxCloud

_boolean_

Default: true

Use Nx Cloud

### packageManager

_string_

Choices: ["npm", "pnpm", "yarn"]

Default: npm

Package manager to use

### preset

_string_

Choices: ["apps", "empty", "core", "npm", "ts", "web-components", "angular", "angular-nest", "react", "react-express", "react-native", "next", "nest", "express"]

Customizes the initial content of your workspace. To build your own see https://nx.dev/nx-plugin/overview#preset

### style

_string_

Style option to be used when a preset with pregenerated app is selected

### version

_boolean_

Show version number
