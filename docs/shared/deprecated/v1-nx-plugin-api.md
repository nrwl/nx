---
title: 'Extending the Project Graph (v1 API)'
description: 'Learn about the deprecated v1 API for extending the Nx project graph through project inference and project graph plugins.'
---

# Extending the Project Graph of Nx (v1 API)

{% callout type="caution" title="Experimental" %}
This API has been superceded by the [v2 API](/extending-nx/recipes/project-graph-plugins) and will be removed in Nx 20. If targeting Nx version 16.7 or higher, please use the v2 API instead.
{% /callout %}

The v1 plugin API for modifying the project graph was split into two parts:

- [Project Inference Plugins](#project-inference-plugins)
- [Project Graph Plugins](#project-graph-plugins)

Project inference plugins are used to infer projects from the file system. Project graph plugins are used to modify the project graph after projects have been identified. In the v2 API, there are still two parts but they are divided differently:

- [createNodes](/extending-nx/recipes/project-graph-plugins#adding-new-nodes-to-the-project-graph)
- [createDependencies](/extending-nx/recipes/project-graph-plugins#adding-new-dependencies-to-the-project-graph)

These are much clearer in terms of responsibility, and are more flexible. The v1 API is still documented below for reference.

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

## Project Inference Plugins

Project inference describes the ability of Nx to discover and work with projects based on source code and configuration files in your repo. Out of the box, Nx identifies projects based on the presence of `package.json` and `project.json` files. It also identifies targets in the `package.json` scripts and the `project.json` `target`s.

Project inference plugins allow you to extend this functionality of Nx to other languages and file structures.

### Project File Patterns

Project file patterns are used in two scenarios:

- Inferring projects
- Determining which files should be passed into `registerProjectTargets`.

Let's use the below plugin and workspace layout as an example:

```typescript {% fileName="libs/awesome-plugin/index.ts" %}
export const projectFilePatterns = ['project.json', 'my-other-project-file'];
export function registerProjectTargets(projectFilePath) {
  console.log(projectFilePath);
}
```

> workspace layout

```text
my-workspace/
├─ node_modules/
├─ libs/
│  ├─ my-project/
│  │  ├─ my-other-project-file
│  ├─ nx-project/
│  │  ├─ my-other-project-file
│  │  ├─ project.json
├─ nx.json
└─ package.json

```

During initialization, we would expect to see "libs/my-project/my-other-project-file", "libs/nx-project/my-other-project-file", "libs/nx-project/project.json" all logged out to the console. Nx was able to infer `my-project` from the layout.

### Implementing a Project Target Configurator

A project target configurator is a function that takes a path to a project file, and returns the targets inferred from that file.

Plugins should export a function named `registerProjectTargets` that infers the targets from each matching project file. This function receives the path to the project file as its sole parameter.

The `registerProjectTargets` function should return a `Record<string, TargetConfiguration>`, which describes the targets inferred for that specific project file.

```typescript
import { TargetConfiguration } from '@nx/devkit';

export const projectFilePatterns = ['project.json', 'my-other-project-file'];

export function registerProjectTargets(
  projectFilePath: string
): Record<string, TargetConfiguration> {
  return {
    build: {
      /**
       * This object should look exactly like a target
       * configured inside `project.json`
       */
    },
  };
}
```

For guidance on implementing a similar function in the v2 API, see the documentation on [createNodes](/extending-nx/recipes/project-graph-plugins#example-extending-projects-adding-inferred-targets).

### Multiple Matches

It is possible that the registerProjectTargets function may be called multiple times for one project. This could occur in a few cases, one of which is demonstrated above.

- One plugin may list multiple file patterns, and a project may match more than one of them.
- Multiple plugins may list similar patterns, and pick up the project separately.

**In the first case**, the plugin that you are writing will be called into multiple times. If you return the same target (e.g. `build`) on each call, whichever is ran last would be the target that Nx calls into.

The order that the function would be called is **NOT** guaranteed, so you should try to avoid this when possible. If specifying multiple patterns, they should either be mutually exclusive (e.g. one match per project) or the plugin should conditionally add targets based on the file passed in.

**In the second case**, different plugins may attempt to register the same target on a project. If this occurs, whichever target was registered by the plugin listed latest in `nx.json` would be the one called into by Nx. As an example, assume `plugin-a`, `plugin-b`, and `plugin-c` all match a file and register `build` as a target. If `nx.json` included `"plugins": ["plugin-a", "plugin-b", "plugin-c"]`, running `nx build my-project` would run the target as defined by `"plugin-c"`.

Alternatively, if `nx.json` included `"plugins": ["plugin-c", "plugin-b", "plugin-a"]`, running `nx build my-project` would run the target as defined by `"plugin-a"`.

### Development Tips

There is a cache that Nx uses to avoid recalculating the project graph as much as possible, but it may need to be skipped during plugin development. You can set the following environment variable to disable the project graph cache: `NX_CACHE_PROJECT_GRAPH=false`.

It might also be a good idea to ensure that the dep graph is not running on the nx daemon by setting `NX_DAEMON=false`, as this will ensure you will be able to see any `console.log` statements you add as you're developing. You can also leave the daemon active, but `console.log` statements would only appear in its log file.

## Project Graph Plugins

The Project Graph is the representation of the source code in your repo. Projects can have files associated with them. Projects can have dependencies on each other.

One of the best features of Nx the ability to construct the project graph automatically by analyzing your source code. Currently, this works best within the JavaScript ecosystem, but it can be extended to other languages and technologies using plugins.

### Implementing a Project Graph Processor

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

### Adding New Nodes to the Project Graph

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

### Adding New Dependencies to the Project Graph

It's more common for plugins to create new dependencies. First-party code contained in the workspace is added to the project graph automatically. Whether your project contains TypeScript or say Java, both projects will be created in the same way. However, Nx does not know how to analyze Java sources, and that's what plugins can do.

You can create 2 types of dependencies.

#### Implicit Dependencies

An implicit dependency is not associated with any file, and can be created as follows:

```typescript
// Add a new edge
builder.addImplicitDependency('existing-project', 'new-project');
```

{% callout type="note" title="More details" %}
Even though the plugin is written in JavaScript, resolving dependencies of different languages will probably be more easily written in their native language. Therefore, a common approach is to spawn a new process and communicate via IPC or `stdout`.
{% /callout %}

Because an implicit dependency is not associated with any file, Nx doesn't know when it might change, so it will be recomputed every time.

#### Static Dependencies

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

#### Dynamic Dependencies

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

### Visualizing the Project Graph

You can then visualize the project graph as described [here](/features/explore-graph). However, there is a cache that Nx uses to avoid recalculating the project graph as much as possible. As you develop your project graph plugin, it might be a good idea to set the following environment variable to disable the project graph cache: `NX_CACHE_PROJECT_GRAPH=false`.

It might also be a good idea to ensure that the dep graph is not running on the nx daemon by setting `NX_DAEMON=false`, as this will ensure you will be able to see any `console.log` statements you add as you're developing.

### Example Project Graph Plugin

The [nrwl/nx-go-project-graph-plugin](https://github.com/nrwl/nx-go-project-graph-plugin) repo contains an example project graph plugin which adds [Go](https://golang.org/) dependencies to the Nx Project Graph! A similar approach can be used for other languages.

{% github-repository url="https://github.com/nrwl/nx-go-project-graph-plugin" /%}
