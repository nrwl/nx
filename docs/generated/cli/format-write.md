---
title: 'format:write - CLI command'
description: 'Overwrite un-formatted files.'
---

# format:write

Overwrite un-formatted files.

## Usage

```shell
nx format:write
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

| Option                       | Type    | Description                                                                                                                                                                                                         |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all`                      | boolean | Format all projects.                                                                                                                                                                                                |
| `--base`                     | string  | Base of the current branch (usually main).                                                                                                                                                                          |
| `--exclude`                  | string  | Exclude certain projects from being processed.                                                                                                                                                                      |
| `--files`                    | string  | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces.                                                                             |
| `--head`                     | string  | Latest commit of the current branch (usually HEAD).                                                                                                                                                                 |
| `--help`                     | boolean | Show help.                                                                                                                                                                                                          |
| `--libs-and-apps`            | boolean | Format only libraries and applications files.                                                                                                                                                                       |
| `--projects`                 | string  | Projects to format (comma/space delimited).                                                                                                                                                                         |
| `--sort-root-tsconfig-paths` | boolean | Ensure the workspace's tsconfig compilerOptions.paths are sorted. Warning: This will cause comments in the tsconfig to be lost. The default value is "true" unless NX_FORMAT_SORT_TSCONFIG_PATHS is set to "false". |
| `--uncommitted`              | boolean | Uncommitted changes.                                                                                                                                                                                                |
| `--untracked`                | boolean | Untracked changes.                                                                                                                                                                                                  |
| `--version`                  | boolean | Show version number.                                                                                                                                                                                                |
