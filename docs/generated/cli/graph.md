---
title: 'graph - CLI command'
description: 'Graph dependencies within workspace. Alias: dep-graph'
---

# graph

Graph dependencies within workspace. Alias: dep-graph

## Usage

```bash
nx graph
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Open the project graph of the workspace in the browser:

```bash
nx graph
```

Save the project graph into a json file:

```bash
nx graph --file=output.json
```

Generate a static website with project graph into an html file, accompanied by an asset folder called static:

```bash
nx graph --file=output.html
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main:

```bash
nx graph --focus=todos-feature-main
```

Include project-one and project-two in the project graph:

```bash
nx graph --include=project-one,project-two
```

Exclude project-one and project-two from the project graph:

```bash
nx graph --exclude=project-one,project-two
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two:

```bash
nx graph --focus=todos-feature-main --exclude=project-one,project-two
```

Watch for changes to project graph and update in-browser:

```bash
nx graph --watch
```

## Options

### exclude

_array_

List of projects delimited by commas to exclude from the project graph.

### file

_string_

Output file (e.g. --file=output.json or --file=dep-graph.html)

### focus

_string_

Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.

### groupByFolder

_boolean_

Group projects by folder in the project graph

### help

_boolean_

Show help

### host

_string_

Bind the project graph server to a specific ip address.

### open

_boolean_

Default: true

Open the project graph in the browser.

### port

_number_

Bind the project graph server to a specific port.

### version

_boolean_

Show version number

### watch

_boolean_

Default: false

Watch for changes to project graph and update in-browser
