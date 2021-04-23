# Extending the Project Graph of Nx

> This API is experimental and might change.

Nx views the workspace as a graph of projects that depend on one another. It's able to infer most projects and dependencies automatically. Currently, this works best within the JavaScript ecosystem, but it can be extended to other languages and technologies as well. This is where project graph plugins come in.

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

Project Graph Plugins are chained together to produce the final project graph. Each plugin may have a Project Graph Processor which iterates upon the project graph. Let's first take a look at the API of Project Graph Plugins. In later sections, we will go over some common use cases. Plugins should export a function named `processProjectGraph` that handles updating the project graph with new nodes and edges. This function receives two things:

- A `ProjectGraph`
  - Nodes in the project graph are the different projects currently in the graph.
  - Edges in the project graph are dependencies between different projects in the graph.
- Some context is also passed into the function to use when processing the project graph. The context contains:
  - The `workspace` which contains both configuration and the different projects.
  - A `fileMap` which has a map of files by projects

> Note: The notion of a workspace is separate from the notion of the project graph. The workspace is first party code that is checked into git, targets are run on, etc. The project graph may include third party packages as well that is not checked into git, not run at all, etc.

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
  // We will see how this is used below.
  return builder.getProjectGraph();
}
```

## Adding New Dependencies to the Project Graph

Project Graph Plugins can add smarter dependency resolution to projects already in the workspace. Projects in the workspace are first party code whose dependencies change as the code in the workspace changes and matter to Nx the most. Such projects should be defined in `workspace.json` and `nx.json` and will be automatically included as nodes in the project graph. However, when some projects are written in other languages, the relationships between these projects will not be clear to Nx out of the box. A Project Graph Plugin can add these relationships.

```typescript
import { DependencyType } from '@nrwl/devkit';

// Add a new edge
builder.addDependency(DependencyType.static, 'existing-project', 'new-project');
```

> Note: Even though the plugin is written in JavaScript, resolving dependencies of different languages will probably be more easily written in their native language. Therefore, a common approach is to spawn a new process and communicate via IPC or `stdout`.

Dependencies can be one of the following types:

- `DependencyType.static` dependencies indicate that a dependency is imported directly into the code and would be present even without running the code.
- `DependencyType.dynamic` dependencies indicate that a dependency _might be_ imported at runtime such as lazy loaded dependencies.
- `DependencyType.implicit` dependencies indicate that one project affects another project's behavior or outcome even though there is no dependency in the code. For example, e2e tests or communication over HTTP.

## Adding New Nodes to the Project Graph

Sometimes it can be valuable to have third party packages as part of the project graph. A Project Graph Plugin can add these packages to the project graph. After these packages are added as nodes to the project graph, dependencies can then be drawn from the workspace projects to the third party packages as well as between the third party packages.

```typescript
// Add a new node
builder.addNode({
  name: 'new-project',
  type: 'npm',
  data: {
    files: [],
  },
});
```

> Note: You can designate any type for the node. This differentiates third party projects from projects in the workspace. Also, like before, retrieving these projects might be easiest within their native language. Therefore, spawning a new process may also be a common approach here.

## Incrementally Reprocessing

Workspaces can have _a lot_ of files and finding dependencies for every file can be expensive. Nx incrementally recalculates the `ProjectGraph` by only looking at files that have changed. Let's take a look at how this works.

Remember that the `ProjectGraph` that is passed into the `processProjectGraph` function is a graph that already has nodes and dependencies. These nodes and dependencies are not _only_ those from prior plugins, but might also be a cached part of the graph that does not need to be recalculated. If files have not been modified since the last calculation, they do not need to be processed again. How do we know which files we _need_ to reprocess?

`ProjectGraphProcessorContext.fileMap` contains only the files that need to be processed. You should, if possible, definitely take advantage of this subset of files to make it cheaper to reprocess the graph.

## Visualizing the Project Graph

You can then visualize the project graph as described [here](/{{framework}}/structure/dependency-graph). However, there is a cache that Nx uses to avoid recalculating the project graph as much as possible. As you develop your project graph plugin, it might be a good idea to set the following environment variable to disable the project graph cache: `NX_CACHE_PROJECT_GRAPH=false`.

## Example Project Graph Plugin

The [nrwl/nx-go-project-graph-plugin](https://github.com/nrwl/nx-go-project-graph-plugin) repo contains an example project graph plugin which adds [Go](https://golang.org/) dependencies to the Nx Project Graph! A similar approach can be used for other languages.
