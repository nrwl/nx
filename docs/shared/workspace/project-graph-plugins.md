# Extending the Project Graph of Nx

> This API is experimental and might change.

Nx views the workspace as a graph of projects that depend on one another. It's able to infer most projects and dependencies automatically. Currently, this works best within the JavaScript ecosystem but it can be extended to other languages and technologies as well.

## Defining Plugins to be used in a workspace

In `nx.json`, add an array of plugins:

```jsonc
{
  ...,
  "plugins": [
    // You can use npm packages
    "awesome-plugin-package",
    // Or implementations defined in your workspace (in JavaScript)
    "./tools/nx-plugins/some-local-workspace-implementation.js"
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
import { getFileData } from '@nrwl/workspace';

export function processProjectGraph(
  graph: ProjectGraph,
  context: ProjectGraphProcessorContext
): ProjectGraph {
  const builder = new ProjectGraphBuilder(graph);

  // ...
  // Where "otherLanguageProjects" is created by you, e.g. using your custom language's toolchain/compiler APIs
  // ...

  // First iterate through and add all the projects as nodes on the graph
  for (const otherLanguageProject of otherLanguageProjects) {
    builder.addNode({
      name: otherLanguageProject.name, // (as an example of what your otherLanguageProject object might look like)
      type: 'lib',
      data: {
        files: [
          // Using getFileData will create a hash of the file contents using Nx's internal hashing alogrithm
          getFileData('/some/file/from/another/language.foo'),
          // ...more files for the project
        ],
      },
    });
  }

  // Now that the projects exist as nodes, iterate through again and create all the dependency relationships between them
  for (const otherLanguageProject of otherLanguageProjects) {
    // (as an example of what your otherLanguageProject object might look like with a deps array)
    for (const depProject of otherLanguageProject.deps) {
      builder.addDependency(
        DependencyType.static,
        otherLanguageProject.name, // (as an example of what your otherLanguageProject object might look like)
        depProject.name // (as an example of what your otherLanguageProject dep object might look like)
      );
    }
  }

  return builder.getProjectGraph();
}
```

## Visualizing the Project Graph

You can then visualize the project graph as described [here](dependency-graph).
