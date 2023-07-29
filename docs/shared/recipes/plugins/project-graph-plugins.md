# Extending the Project Graph of Nx

{% callout type="caution" title="Experimental" %}
This API is experimental and might change.
{% /callout %}

The Project Graph is the representation of the source code in your repo. Projects can have files associated with them. Projects can have dependencies on each other.

One of the best features of Nx the ability to construct the project graph automatically by analyzing your source code. Currently, this works best within the JavaScript ecosystem, but it can be extended to other languages and technologies using plugins.

## Adding Plugins to Workspace

You can register a plugin by adding it to the plugins array in `nx.json`:

```jsonc {% fileName="nx.json" %}
{
  ...,
  "plugins": [
    "awesome-plugin"
  ]
}
```

## Implementing a Project Graph Processor

A Project Graph Processor takes a project graph and returns a new project graph. It can add/remove nodes and edges.

Plugins should export a function named `processProjectGraph` that handles updating the project graph with new nodes and edges. This function receives two things:

- A `ProjectGraph`

  - `graph.nodes` lists all the projects currently known to Nx.
  - `graph.dependencies` lists the dependencies between projects.

- A `Context`
  - `context.workspace` contains the combined configuration for the workspace.
  - `files` contains all the files found in the workspace.
  - `filesToProcess` contains all the files that have changed since the last invocation and need to be reanalyzed.

The `processProjectGraph` function should return an updated `ProjectGraph`. This is most easily done using `ProjectGraphBuilder`. The builder is there for convenience, so you don't have to use it.

```typescript
import {
  ProjectGraph,
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
  DependencyType,
} from '@nx/devkit';

export function processProjectGraph(
  graph: ProjectGraph,
  context: ProjectGraphProcessorContext
): ProjectGraph {
  const builder = new ProjectGraphBuilder(graph);
  // We will see how this is used below.
  return builder.getUpdatedProjectGraph();
}
```

## Adding New Nodes to the Project Graph

You can add nodes to the project graph. Since first-party code is added to the graph automatically, this is most commonly used for third-party packages.

A Project Graph Plugin can add them to the project graph. After these packages are added as nodes to the project graph, dependencies can then be drawn from the workspace projects to the third party packages as well as between the third party packages.

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

{% callout type="note" title="More details" %}
You can designate any type for the node. This differentiates third party projects from projects in the workspace. If you are writing a plugin for a different language, it's common to use IPC to get the list of nodes which you can then add using the builder.
{% /callout %}

## Adding New Dependencies to the Project Graph

It's more common for plugins to create new dependencies. First-party code contained in the workspace is added to the project graph automatically. Whether your project contains TypeScript or say Java, both projects will be created in the same way. However, Nx does not know how to analyze Java sources, and that's what plugins can do.

You can create 2 types of dependencies.

### Implicit Dependencies

An implicit dependency is not associated with any file, and can be created as follows:

```typescript
// Add a new edge
builder.addImplicitDependency('existing-project', 'new-project');
```

{% callout type="note" title="More details" %}
Even though the plugin is written in JavaScript, resolving dependencies of different languages will probably be more easily written in their native language. Therefore, a common approach is to spawn a new process and communicate via IPC or `stdout`.
{% /callout %}

Because an implicit dependency is not associated with any file, Nx doesn't know when it might change, so it will be recomputed every time.

## Static Dependencies

Nx knows what files have changed since the last invocation. Only those files will be present in the provided `filesToProcess`. You can associate a dependency with a particular file (e.g., if that file contains an import).

```typescript
// Add a new edge
builder.addStaticDependency(
  'existing-project',
  'new-project',
  'libs/existing-project/src/index.ts'
);
```

If a file hasn't changed since the last invocation, it doesn't need to be reanalyzed. Nx knows what dependencies are associated with what files, so it will reuse this information for the files that haven't changed.

## Dynamic Dependencies

Dynamic dependencies are a special type of explicit dependencies. In contrast to standard `explicit` dependencies, they are only imported in the runtime under specific conditions.
A typical example would be lazy-loaded routes. Having separation between these two allows us to identify situations where static import breaks the lazy-loading.

```typescript
import { DependencyType } from '@nx/devkit';

// Add a new edge
builder.addDynamicDependency(
  'existing-project',
  'lazy-route',
  'libs/existing-project/src/router-setup.ts'
);
```

## Visualizing the Project Graph

You can then visualize the project graph as described [here](/core-features/explore-graph). However, there is a cache that Nx uses to avoid recalculating the project graph as much as possible. As you develop your project graph plugin, it might be a good idea to set the following environment variable to disable the project graph cache: `NX_CACHE_PROJECT_GRAPH=false`.

It might also be a good idea to ensure that the dep graph is not running on the nx daemon by setting `NX_DAEMON=false`, as this will ensure you will be able to see any `console.log` statements you add as you're developing.

## Example Project Graph Plugin

The [nrwl/nx-go-project-graph-plugin](https://github.com/nrwl/nx-go-project-graph-plugin) repo contains an example project graph plugin which adds [Go](https://golang.org/) dependencies to the Nx Project Graph! A similar approach can be used for other languages.

{% github-repository url="https://github.com/nrwl/nx-go-project-graph-plugin" /%}
