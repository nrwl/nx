---
title: 'graph - CLI command'
description: 'Graph dependencies within workspace'
---

# graph

Graph dependencies within workspace

## Usage

```terminal
nx graph
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Open the project graph of the workspace in the browser:

```terminal
 nx graph
```

Save the project graph into a json file:

```terminal
 nx graph --file=output.json
```

Generate a static website with project graph into an html file, accompanied by an asset folder called static:

```terminal
 nx graph --file=output.html
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main:

```terminal
 nx graph --focus=todos-feature-main
```

Include project-one and project-two in the project graph:

```terminal
 nx graph --include=project-one,project-two
```

Exclude project-one and project-two from the project graph:

```terminal
 nx graph --exclude=project-one,project-two
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two:

```terminal
 nx graph --focus=todos-feature-main --exclude=project-one,project-two
```

Watch for changes to project graph and update in-browser:

```terminal
 nx graph --watch
```

## Options

### exclude

Type: `array`

List of projects delimited by commas to exclude from the project graph.

### file

Type: `string`

Output file (e.g. --file=output.json or --file=dep-graph.html)

### focus

Type: `string`

Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.

### groupByFolder

Type: `boolean`

Group projects by folder in the project graph

### help

Type: `boolean`

Show help

### host

Type: `string`

Bind the project graph server to a specific ip address.

### open

Type: `boolean`

Default: `true`

Open the project graph in the browser.

### port

Type: `number`

Bind the project graph server to a specific port.

### version

Type: `boolean`

Show version number

### watch

Type: `boolean`

Default: `false`

Watch for changes to project graph and update in-browser
