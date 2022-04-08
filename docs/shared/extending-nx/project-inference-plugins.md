# Project Inference

> This API is experimental and might change.

Project inference describes the ability of Nx to discover and work with projects based on source code and configuration files in your repo.

One of the best examples of this in Nx is that `package.json` scripts are automatically inferred as targets for your workspace. If using nx core, and no plugins, you can also see this as projects defined in your `package.json` workspace are inferred as Nx projects.

## Adding Plugins to Workspace

You can register a plugin by adding it to the plugins array in `nx.json`:

```json
{
  ...,
  "plugins": [
    "awesome-plugin"
  ]
}
```

## Project File Patterns

Project file patterns are used in two scenarios:

- Inferring projects when `workspace.json` is not present
- Determining which files should be passed into `registerProjectTargets`.

Lets use the below plugin and workspace layout as an example:

> libs/awesome-plugin/index.ts

```typescript
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
├─ package.json

```

During initialization, we would expect to see "libs/my-project/my-other-project-file", "libs/nx-project/my-other-project-file", "libs/nx-project/project.json" all logged out to the console. Since `workspace.json` is not present, Nx was able to infer `my-project` from the layout.

If `workspace.json` was present, `my-project` wouldn't be able to be inferred, since full project inference requires `workspace.json` to be absent.

## Implementing a Project Target Configurator

A project target configurator is a function that takes a path to a project file, and returns the targets inferred from that file.

Plugins should export a function named `registerProjectTargets` that infers the targets from each matching project file. This function receives the path to the project file as its sole parameter.

The `registerProjectTargets` function should return a `Record<string, TargetConfiguration>`, which describes the targets inferred for that specific project file.

```typescript
import {
  TargetConfiguration
} from '@nrwl/devkit';

export function registerProjectTargets(
  projectFilePath: string
): Record<string, TargetConfiguration> {
  return {
    "build" {
      /**
       * This object should look exactly like a target
       * configured inside `project.json`
       */
    }
  }
}
```

## Multiple Matches

It is possible that the registerProjectTargets function may be called multiple times for one project. This could occur in a few cases, one of which is demonstrated above.

- One plugin may list multiple file patterns, and a project may match more than one of them.
- Multiple plugins may list similar patterns, and pick up the project separately.

In the first case, the plugin that you are writing will be called into multiple times. If you return the same target (e.g. `build`) on each call, whichever is ran last would be the target that Nx calls into. The order that the function would be called is **NOT** guaranteed, so you should try to avoid this when possible. If specifying multiple patterns, they should either be mutually exclusive (e.g. one match per project) or the plugin should conditionally add targets based on the file passed in.

In the second case, different plugins may attempt to register the same target on a project. If this occurs, whichever target was registered by the plugin listed latest in `nx.json` would be the one called into by Nx. As an example, assume `plugin-a`, `plugin-b`, and `plugin-c` all match a file and register `build` as a target. If `nx.json` included `"plugins": ["plugin-a", "plugin-b", "plugin-c"]`, running `nx build my-project` would run the target as defined by `"plugin-c"`. Alternatively, if `nx.json` included `"plugins": ["plugin-c", "plugin-b", "plugin-a"]`, running `nx build my-project` would run the target as defined by `"plugin-a"`

## Visualizing the Project Graph

You can then visualize the project graph as described [here](/structure/dependency-graph). However, there is a cache that Nx uses to avoid recalculating the project graph as much as possible. As you develop your project graph plugin, it might be a good idea to set the following environment variable to disable the project graph cache: `NX_CACHE_PROJECT_GRAPH=false`. It might also be a good idea to ensure that the dep graph is not running on the nx daemon by setting `NX_DAEMON=false`, as this will ensure you will be able to see any `console.log` statements you add as you're developing.
