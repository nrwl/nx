---
title: 'watch - CLI command'
description: 'Watch for changes within projects, and execute commands.'
---

# watch

Watch for changes within projects, and execute commands.

## Usage

```shell
nx watch
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Watch the "app" project and echo the project name and the files that changed:

```shell
 nx watch --projects=app -- echo \$NX_PROJECT_NAME \$NX_FILE_CHANGES
```

Watch "app1" and "app2" and echo the project name whenever a specified project or its dependencies change:

```shell
 nx watch --projects=app1,app2 --includeDependentProjects -- echo \$NX_PROJECT_NAME
```

Watch all projects (including newly created projects) in the workspace:

```shell
 nx watch --all -- echo \$NX_PROJECT_NAME
```

## Options

| Option                              | Type    | Description                                                                 |
| ----------------------------------- | ------- | --------------------------------------------------------------------------- |
| `--all`                             | boolean | Watch all projects.                                                         |
| `--help`                            | boolean | Show help.                                                                  |
| `--includeDependentProjects`, `--d` | boolean | When watching selected projects, include dependent projects as well.        |
| `--initialRun`, `--i`               | boolean | Run the command once before watching for changes. (Default: `false`)        |
| `--projects`, `--p`                 | string  | Projects to watch (comma/space delimited).                                  |
| `--verbose`                         | boolean | Run watch mode in verbose mode, where commands are logged before execution. |
| `--version`                         | boolean | Show version number.                                                        |
