# dep-graph

Graph dependencies within workspace

## Usage

```bash
nx dep-graph
```

Install `@nrwl/cli` globally to invoke the command directly using `nx`, or use `npm run nx` or `yarn nx`.

### Examples

Open the dep graph of the workspace in the browser:

```bash
nx dep-graph
```

Save the dep graph into a json file:

```bash
nx dep-graph --file=output.json
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main.:

```bash
nx dep-graph --filter=todos-feature-main
```

Exclude project-one and project-two from the dep graph.:

```bash
nx dep-graph --exclude=project-one,project-two
```

## Options

### exclude

List of projects delimited by commas to exclude from the dependency graph.

### file

output file (e.g. --file=output.json)

### filter

Use to limit the dependency graph to only show specific projects, list of projects delimited by commas.

### help

Show help

### version

Show version number
