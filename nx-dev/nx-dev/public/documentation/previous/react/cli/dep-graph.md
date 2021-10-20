# dep-graph

Graph dependencies within workspace

## Usage

```bash
nx dep-graph
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Open the dep graph of the workspace in the browser:

```bash
nx dep-graph
```

Save the dep graph into a json file:

```bash
nx dep-graph --file=output.json
```

Generate a static website with dep graph into an html file, accompanied by an asset folder called static:

```bash
nx dep-graph --file=output.html
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main:

```bash
nx dep-graph --focus=todos-feature-main
```

Include project-one and project-two in the dep graph:

```bash
nx dep-graph --include=project-one,project-two
```

Exclude project-one and project-two from the dep graph:

```bash
nx dep-graph --exclude=project-one,project-two
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two:

```bash
nx dep-graph --focus=todos-feature-main --exclude=project-one,project-two
```

Watch for changes to dep graph and update in-browser:

```bash
nx dep-graph --watch
```

## Options

### exclude

List of projects delimited by commas to exclude from the dependency graph.

### file

Output file (e.g. --file=output.json or --file=dep-graph.html)

### focus

Use to show the dependency graph for a particular project and every node that is either an ancestor or a descendant.

### groupByFolder

Group projects by folder in the dependency graph

### help

Show help

### host

Bind the dependency graph server to a specific ip address.

### open

Default: `true`

Open the dependency graph in the browser.

### port

Bind the dependecy graph server to a specific port.

### version

Show version number

### watch

Default: `false`

Watch for changes to dependency graph and update in-browser
