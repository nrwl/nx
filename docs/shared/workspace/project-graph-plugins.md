# Extending the Project Graph of Nx

> This API is experimental and might change.

Nx views the workspace as a graph of projects that depend on one another. It's able to infer most projects and dependencies automatically. Currently, this works best within the Javascript ecosystem but it can be extended to other languages and technologies as well.

## Defining Plugins to be used in a workspace

In `nx.json`, add an array of plugins:

```json
{
  ...,
  "plugins": [
    "awesome-plugin"
  ]
}
```

These plugins are used when running targets, linting, and sometimes when generating code.

## Implementing a Project Graph Processor

Project Graph Plugins are chained together to produce the final project graph. Each plugin may have a Project Graph Processor which iterates upon the project graph. Plugins should export a function named `processProjectGraph` that handles updating the project graph with new nodes and edges. This function receives two things:

- A `ProjectGraph`
  - Nodes in the project graph are the different projects currently in the graph.
  - Edges in the project graph are dependencies between different projects in the graph.
- Some context is also passed into the function to use when processing the project graph. The context contains:
  - The `workspace` which contains both configuration as well as the different projects.
  - A `fileMap` which has a map of files by projects

The `processProjectGraph` function should return an updated `ProjectGraph`. This is most easily done using the `ProjectGraphBuilder` to iteratively add edges and nodes to the graph:

```typescript
import {
  ProjectGraph,
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
  DependencyType,
} from '@nrwl/devkit';

export function processProjectGraph(
  graph: ProjectGraph,
  context: ProjectGraphProcessorContext
): ProjectGraph {
  const builder = new ProjectGraphBuilder(graph);

  // Add a new node
  builder.addNode({
    name: 'new-project',
    type: 'lib',
    data: {
      files: [],
    },
  });

  // Add a new edge
  builder.addDependency(
    DependencyType.static,
    'existing-project',
    'new-project'
  );

  return builder.getProjectGraph();
}
```

## Visualizing the Project Graph

You can then visualize the project graph as described [here](dependency-graph).
