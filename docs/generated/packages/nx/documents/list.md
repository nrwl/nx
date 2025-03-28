---
title: 'list - CLI command'
description: 'Lists installed plugins, capabilities of installed plugins and other available plugins.'
---

# list

Lists installed plugins, capabilities of installed plugins and other available plugins.

## Usage

```shell
nx list [plugin]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

List the plugins installed in the current workspace:

```shell
 nx list
```

List the generators and executors available in the `@nx/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace):

```shell
 nx list @nx/web
```

## Options

| Option      | Type    | Description                               |
| ----------- | ------- | ----------------------------------------- |
| `--help`    | boolean | Show help.                                |
| `--plugin`  | string  | The name of an installed plugin to query. |
| `--version` | boolean | Show version number.                      |
