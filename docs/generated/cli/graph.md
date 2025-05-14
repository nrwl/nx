---
title: 'graph - CLI command'
description: 'Graph dependencies within workspace.'
---

# graph

Graph dependencies within workspace.

## Usage

```shell
nx graph
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Open the project graph of the workspace in the browser:

```shell
 nx graph
```

Save the project graph into a json file:

```shell
 nx graph --file=output.json
```

Generate a static website with project graph into an html file, accompanied by an asset folder called static:

```shell
 nx graph --file=output.html
```

Print the project graph as JSON to the console:

```shell
 nx graph --print
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main:

```shell
 nx graph --focus=todos-feature-main
```

Exclude project-one and project-two from the project graph:

```shell
 nx graph --exclude=project-one,project-two
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two:

```shell
 nx graph --focus=todos-feature-main --exclude=project-one,project-two
```

Watch for changes to project graph and update in-browser:

```shell
 nx graph --watch
```

## Options

| Option            | Type                | Description                                                                                                                             |
| ----------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `--affected`      | boolean             | Highlight affected projects.                                                                                                            |
| `--base`          | string              | Base of the current branch (usually main).                                                                                              |
| `--exclude`       | string              | Exclude certain projects from being processed.                                                                                          |
| `--file`          | string              | Output file (e.g. --file=output.json or --file=dep-graph.html).                                                                         |
| `--files`         | string              | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces. |
| `--focus`         | string              | Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.                       |
| `--groupByFolder` | boolean             | Group projects by folder in the project graph.                                                                                          |
| `--head`          | string              | Latest commit of the current branch (usually HEAD).                                                                                     |
| `--help`          | boolean             | Show help.                                                                                                                              |
| `--host`          | string              | Bind the project graph server to a specific ip address.                                                                                 |
| `--open`          | boolean             | Open the project graph in the browser. (Default: `true`)                                                                                |
| `--port`          | number              | Bind the project graph server to a specific port.                                                                                       |
| `--print`         | boolean             | Print the project graph to stdout in the terminal.                                                                                      |
| `--targets`       | string              | The target to show tasks for in the task graph.                                                                                         |
| `--uncommitted`   | boolean             | Uncommitted changes.                                                                                                                    |
| `--untracked`     | boolean             | Untracked changes.                                                                                                                      |
| `--verbose`       | boolean             | Prints additional information about the commands (e.g., stack traces).                                                                  |
| `--version`       | boolean             | Show version number.                                                                                                                    |
| `--view`          | `projects`, `tasks` | Choose whether to view the projects or task graph. (Default: `projects`)                                                                |
| `--watch`         | boolean             | Watch for changes to project graph and update in-browser. (Default: `true`)                                                             |
