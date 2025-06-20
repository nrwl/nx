---
title: nx graph
description: 'Graph dependencies within workspace.'
---

# `nx graph`

Graph dependencies within workspace.

## Aliases

- `dep-graph`


## Usage

```bash
nx graph [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--affected` | boolean | No description available |  |
| `--base` | string | Base of the current branch (usually main) |  |
| `--exclude` | string | List of projects delimited by commas to exclude from the project graph. |  |
| `--file` | string | Output file (e.g. --file=output.json or --file=dep-graph.html). |  |
| `--files` | string | Change the way Nx is calculating the affected command |  |
| `--focus` | string | Use to show the project graph for a particular project and every node that is either an ancestor or a descendant. |  |
| `--groupByFolder` | boolean | Group projects by folder in the project graph. |  |
| `--head` | string | Latest commit of the current branch (usually HEAD) |  |
| `--host` | string | Bind the project graph server to a specific ip address. |  |
| `--open` | boolean | Open the project graph in the browser. | `true` |
| `--port` | number | Bind the project graph server to a specific port. |  |
| `--print` | boolean | Print the project graph to stdout in the terminal. |  |
| `--targets` | string | The target to show tasks for in the task graph. |  |
| `--uncommitted` | boolean | Uncommitted changes |  |
| `--verbose` | boolean | Enable verbose logging | `false` |
| `--view` | string | Choose whether to view the projects or task graph. | `'projects'` |
| `--watch` | boolean | Watch for changes to project graph and update in-browser. | `true` |



