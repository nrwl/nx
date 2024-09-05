---
title: 'add - CLI command'
description: 'Install a plugin and initialize it.'
---

# add

Install a plugin and initialize it.

## Usage

```shell
nx add <packageSpecifier>
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Install the `@nx/react` package matching the installed version of the `nx` package and run its `@nx/react:init` generator:

```shell
 nx add @nx/react
```

Install the latest version of the `non-core-nx-plugin` package and run its `non-core-nx-plugin:init` generator if available:

```shell
 nx add non-core-nx-plugin
```

Install version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator:

```shell
 nx add @nx/react@17.0.0
```

## Options

| Option                   | Type    | Description                                                                                                                                                                                                                                                  |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--help`                 | boolean | Show help.                                                                                                                                                                                                                                                   |
| `--packageSpecifier`     | string  | The package name and optional version (e.g. `@nx/react` or `@nx/react@latest`) to install and initialize. If the version is not specified it will install the same version as the `nx` package for Nx core plugins or the latest version for other packages. |
| `--updatePackageScripts` | boolean | Update `package.json` scripts with inferred targets. Defaults to `true` when the package is a core Nx plugin.                                                                                                                                                |
| `--verbose`              | boolean | Prints additional information about the commands (e.g., stack traces).                                                                                                                                                                                       |
| `--version`              | boolean | Show version number.                                                                                                                                                                                                                                         |
