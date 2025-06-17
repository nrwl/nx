---
title: Extending the Project Graph
description: Learn how to create project graph plugins for Nx to add custom nodes and dependencies, enabling support for additional languages and technologies.
---

# Extending the Project Graph of Nx

The Project Graph is the representation of the source code in your repo. Projects can have files associated with them. Projects can have dependencies on each other.

One of the best features of Nx the ability to construct the project graph automatically by analyzing your source code. Currently, this works best within the JavaScript ecosystem, but it can be extended to other languages and technologies using plugins.

Project graph plugins are able to add new nodes or dependencies to the project graph. This allows you to extend the project graph with new projects and dependencies. The API is defined by two exported members, which are described below:

- [createNodesV2](#adding-new-nodes-to-the-project-graph): This tuple allows a plugin to tell Nx information about projects that are identified by a given file.
- [createDependencies](#adding-new-dependencies-to-the-project-graph): This function allows a plugin to tell Nx about dependencies between projects.

{% callout type="warning" title="Disable the Nx Daemon during development" %}
When developing project graph plugins, disable the [Nx Daemon](/concepts/nx-daemon) by setting `NX_DAEMON=false`. The daemon caches your plugin code, so changes to your plugin won't be reflected until the daemon restarts.
{% /callout %}

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

## Adding New Nodes to the Project Graph

You can add nodes to the project graph with [`createNodesV2`](/reference/core-api/devkit/documents/CreateNodesV2). This is the API that Nx uses under the hood to identify Nx projects coming from a `project.json` file or a `package.json` that's listed in a package manager's workspaces section.

### Identifying Projects

Looking at the tuple, you can see that the first element is a file pattern. This is a glob pattern that Nx will use to find files in your workspace. The second element is a function that will be called for each file that matches the pattern. The function will be called with the path to the file and a context object. Your plugin can then return a set of projects and external nodes.

If a plugin identifies a project that is already in the project graph, it will be merged with the information that is already present. The builtin plugins that identify projects from `package.json` files and `project.json` files are ran after any plugins listed in `nx.json`, and as such will overwrite any configuration that was identified by them. In practice, this means that if a project has both a `project.json`, and a file that your plugin identified, the settings the plugin identified will be overwritten by the `project.json`'s contents.

Project nodes in the graph are considered to be the same if the project has the same root. If multiple plugins identify a project with the same root, the project will be merged. In doing so, the name that is already present in the graph is kept, and the properties below are shallowly merged. Any other properties are overwritten.

- `targets`
- `tags`
- `implicitDependencies`
- `generators`

Note: This is a shallow merge, so if you have a target with the same name in both plugins, the target from the second plugin will overwrite the target from the first plugin. Options, configurations, or any other properties within the target will be overwritten **_not_** merged.

#### Example (adding projects)

A simplified version of Nx's built-in `project.json` plugin is shown below, which adds a new project to the project graph for each `project.json` file it finds. This should be exported from the entry point of your plugin, which is listed in `nx.json`

```typescript {% fileName="/my-plugin/index.ts" %}
import { createNodesFromFiles, readJsonFile } from '@nx/devkit';
import { dirname } from 'path';

export interface MyPluginOptions {}

export const createNodesV2: CreateNodesV2<MyPluginOptions> = [
  '**/project.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        createNodesInternal(configFile, options, context),
      configFiles,
      options,
      context
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: MyPluginOptions,
  context: CreateNodesContextV2
) {
  const projectConfiguration = readJsonFile(configFilePath);
  const root = dirname(configFilePath);

  // Project configuration to be merged into the rest of the Nx configuration
  return {
    projects: {
      [root]: projectConfiguration,
    },
  };
}
```

{% callout type="warning" title="Dynamic target configurations can't be migrated" %}

If you create targets for a project within a plugin's code, the Nx migration generators can not find that target configuration to update it. There are two ways to account for this:

1. Only create dynamic targets using executors that you own. This way you can update the configuration in both places when needed.
2. If you create a dynamic target for an executor you don't own, only define the `executor` property and instruct your users to define their options in the `targetDefaults` property of `nx.json`.

{% /callout %}

#### Example (extending projects / adding inferred targets)

When writing a plugin to add support for some tooling, it may need to add a target to an existing project. For example, our @nx/jest plugin adds a target to the project for running Jest tests. This is done by checking for the presence of a jest configuration file, and if it is present, adding a target to the project.

Most of Nx's first party plugins are written to add a target to a given project based on the configuration files present for that project. The below example shows how a plugin could add a target to a project based on the presence of a `tsconfig.json` file.

```typescript {% fileName="/my-plugin/index.ts" %}
import { createNodesFromFiles, readJsonFile } from '@nx/devkit';
import { dirname } from 'path';

export interface MyPluginOptions {}

export const createNodesV2: CreateNodesV2<MyPluginOptions> = [
  '**/tsconfig.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        createNodesInternal(configFile, options, context),
      configFiles,
      options,
      context
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: MyPluginOptions,
  context: CreateNodesContextV2
) {
  const projectConfiguration = readJsonFile(configFilePath);
  const projectRoot = dirname(configFilePath);

  const isProject =
    existsSync(join(projectRoot, 'project.json')) ||
    existsSync(join(projectRoot, 'package.json'));
  if (!isProject) {
    return {};
  }

  return {
    projects: {
      [projectRoot]: {
        targets: {
          build: {
            command: `tsc -p ${fileName}`,
          },
        },
      },
    },
  };
}
```

By checking for the presence of a `project.json` or `package.json` file, the plugin can be more confident that the project it is modifying is an existing Nx project.

When extending an existing project, its important to consider how Nx will merge the returned project configurations. In general, plugins are run in the order they are listed in `nx.json`, and then Nx's built-in plugins are run last. Plugins overwrite information that was identified by plugins that ran before them if a merge is not possible.

Nx considers two identified projects to be the same if and only if they have the same root. If two projects are identified with the same name, but different roots, there will be an error.

The logic for merging project declarations is as follows:

- `name`, `sourceRoot`, `projectType`, and any other top level properties which are a literal (e.g. not an array or object) are overwritten.
- `tags` are merged and deduplicated.
- `implicitDependencies` are merged, with dependencies from later plugins being appended to the end
- `targets` are merged, with special logic for the targets inside of them:
  - If the targets are deemed compatible (They use the same executor / command, or one of the two declarations does not specify an executor / command):
    - The `executor` or `command` remains the same
    - The `options` object is merged with the later plugin's options overwriting the earlier plugin's options. This is a shallow merge, so if a property is an object, the later plugin's object will overwrite the earlier plugin's object rather than merging the two.
    - The `configurations` object is merged, with the later plugin's configurations overwriting the earlier plugin's configurations. The options for each configuration are merged in the same way as the top level options.
    - `inputs` and `outputs` overwrite the earlier plugin's inputs and outputs.
  - If the targets are not deemed compatible, the later plugin's target will overwrite the earlier plugin's target.
- `generators` are merged. If both project configurations specify the same generator, those generators are merged.
- `namedInputs` are merged. If both project configurations specify the same named input, the later plugin's named input will overwrite the earlier plugin's named input. This is what allows overriding a named input from a plugin that ran earlier (e.g. in project.json).

### Adding External Nodes

Additionally, plugins can add external nodes to the project graph. External nodes are nodes that are not part of the workspace, but are still part of the project graph. This is useful for things like npm packages, or other external dependencies that are not part of the workspace.

External nodes are identified by a unique name, and if plugins identify an external node with the same name, the external node will be **_overwritten_**. This is different from projects, where the properties are merged, but is handled this way as it should not be as common and there are less useful properties to merge.

## Adding New Dependencies to the Project Graph

It's more common for plugins to create new dependencies. First-party code contained in the workspace is added to the project graph automatically. Whether your project contains TypeScript or say Java, both projects will be created in the same way. However, Nx does not know how to analyze Java sources, and that's what plugins can do.

The shape of the [`createDependencies`](/reference/core-api/devkit/documents/CreateDependencies) function follows:

```typescript
export type CreateDependencies<T> = (
  opts: T,
  context: CreateDependenciesContext
) => CandidateDependency[] | Promise<CandidateDependency[]>;
```

In the `createDependencies` function, you can analyze the files in the workspace and return a list of dependencies. It's up to the plugin to determine how to analyze the files. This should also be exported from the plugin's entry point, as listed in `nx.json`.

Within the `CreateDependenciesContext`, you have access to the graph's external nodes, the configuration of each project in the workspace, the `nx.json` configuration from the workspace, all files in the workspace, and files that have changed since the last invocation. It's important to utilize the `filesToProcess` parameter, as this will allow Nx to only reanalyze files that have changed since the last invocation, and reuse the information from the previous invocation for files that haven't changed.

`@nx/devkit` exports a function called `validateDependency` which can be used to validate a dependency. This function takes in a `CandidateDependency` and the `CreateDependenciesContext` and throws an error if the dependency is invalid. This function is called when the returned dependencies are merged with the existing project graph, but may be useful to call within your plugin to validate dependencies before returning them when debugging.

The dependencies can be of three types:

- Implicit
- Static
- Dynamic

### Implicit Dependencies

An implicit dependency is not associated with any file, and can be created as follows:

```typescript
{
  source: 'existing-project',
  target: 'new-project',
  dependencyType: DependencyType.implicit,
}
```

Because an implicit dependency is not associated with any file, Nx doesn't know when it might change, so it will be recomputed every time.

### Static Dependencies

Nx knows what files have changed since the last invocation. Only those files will be present in the provided `filesToProcess`. You can associate a dependency with a particular file (e.g., if that file contains an import).

```typescript
{
  source: 'existing-project',
  target: 'new-project',
  sourceFile: 'libs/existing-project/src/index.ts',
  dependencyType: DependencyType.static,
}
```

If a file hasn't changed since the last invocation, it doesn't need to be reanalyzed. Nx knows what dependencies are associated with what files, so it will reuse this information for the files that haven't changed.

### Dynamic Dependencies

Dynamic dependencies are a special type of explicit dependencies. In contrast to standard `explicit` dependencies, they are only imported in the runtime under specific conditions.
A typical example would be lazy-loaded routes. Having separation between these two allows us to identify situations where static import breaks the lazy-loading.

```typescript
{
  source: 'existing-project',
  target: 'new-project',
  sourceFile: 'libs/existing-project/src/index.ts',
  dependencyType: DependencyType.dynamic,
}
```

### Example

{% callout type="note" title="More details" %}
Even though the plugin is written in JavaScript, resolving dependencies of different languages will probably be more easily written in their native language. Therefore, a common approach is to spawn a new process and communicate via IPC or `stdout`.
{% /callout %}

A small plugin that recognizes dependencies to projects in the current workspace which a referenced in another project's `package.json` file may look like so:

```typescript {% fileName="/my-plugin/index.ts" %}
export const createDependencies: CreateDependencies = (opts, ctx) => {
  const packageJsonProjectMap = new Map();
  const nxProjects = Object.values(ctx.projectsConfigurations);
  const results = [];
  for (const project of nxProjects) {
    const maybePackageJsonPath = join(project.root, 'package.json');
    if (existsSync(maybePackageJsonPath)) {
      const json = JSON.parse(maybePackageJsonPath);
      packageJsonProjectMap.set(json.name, project.name);
    }
  }
  for (const project of nxProjects) {
    const maybePackageJsonPath = join(project.root, 'package.json');
    if (existsSync(maybePackageJsonPath)) {
      const json = JSON.parse(maybePackageJsonPath);
      const deps = [...Object.keys(json.dependencies)];
      for (const dep of deps) {
        if (packageJsonProjectMap.has(dep)) {
          const newDependency = {
            source: project,
            target: packageJsonProjectMap.get(dep),
            sourceFile: maybePackageJsonPath,
            dependencyType: DependencyType.static,
          };
        }
        validateDependency(newDependency, ctx);
        results.push(newDependency);
      }
    }
  }
  return results;
};
```

Breaking down this example, we can see that it follows this flow:

1. Initializes an array to hold dependencies it locates
2. Builds a map of all projects in the workspace, mapping the name inside their package.json to their Nx project name.
3. Looks at the package.json files within the workspace and:
4. Checks if the dependency is another project
5. Builds a dependency from this information
6. Validates the dependency
7. Pushes it into the located dependency array
8. Returns the located dependencies

## Accepting Plugin Options

When looking at `createNodesV2`, and `createDependencies` you may notice a parameter called `options`. This is the first parameter for `createDependencies` or the second parameter for `createDependencies`.

By default, its typed as unknown. This is because it belongs to the plugin author. The `CreateNodes`, `CreateDependencies`, and `NxPluginV2` types all accept a generic parameter that allows you to specify the type of the options.

The options are read from `nx.json` when your plugin is specified as an object rather than just its module name.

As an example, the below `nx.json` file specifies a plugin called `my-plugin` and passes it an option called `tagName`.

```json
{
  "plugins": [
    {
      "plugin": "my-plugin",
      "options": {
        "tagName": "plugin:my-plugin"
      }
    }
  ]
}
```

`my-plugin` could then consume these options to add a tag to each project it detected:

```typescript
import { createNodesFromFiles } from '@nx/devkit';
import { dirname } from 'path';

type MyPluginOptions = { tagName: string };

export const createNodesV2: CreateNodesV2<MyPluginOptions> = [
  '**/tsconfig.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        const root = dirname(configFile);

        return {
          projects: {
            [root]: {
              tags: options.tagName ? [options.tagName] : [],
            },
          },
        };
      configFiles,
      options,
      context
    );
  },
];
```

This functionality is available in Nx 17 or higher.

## Visualizing the Project Graph

You can then visualize the project graph as described [here](/features/explore-graph). However, there is a cache that Nx uses to avoid recalculating the project graph as much as possible. As you develop your project graph plugin, it might be a good idea to set the following environment variable to disable the project graph cache: `NX_CACHE_PROJECT_GRAPH=false`.

<!-- TODO (@AgentEnder): update the nx-go-project-graph-plugin to v2 API and re-add this section -->
<!-- ## Example Project Graph Plugin

The [nrwl/nx-go-project-graph-plugin](https://github.com/nrwl/nx-go-project-graph-plugin) repo contains an example project graph plugin which adds [Go](https://golang.org/) dependencies to the Nx Project Graph! A similar approach can be used for other languages.

{% github-repository url="https://github.com/nrwl/nx-go-project-graph-plugin" /%} -->
