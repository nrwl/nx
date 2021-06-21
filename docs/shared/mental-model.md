# Mental Model

Nx is a VSCode of build tools, with a powerful core, driven by metadata, and extensible through plugins. Nx works with a few concepts to drive your monorepo efficiently, and effectively. This guide covers the mental model around how Nx works with project graphs, task graphs, affected commands, computation hashing and caching.

## The project graph

A project graph is used to reflect the source code in your repository and all the external dependencies that aren’t authored in your repository, such as Webpack, React, Angular, and so forth.

![project-graph](/shared/mental-model/project-graph.png)

With Nx, nodes in the project graph are defined in `workspace.json`. You can manually define dependencies between the nodes, but you don’t have to do it very often. Nx analyzes files’ source code, your installed dependencies, TypeScript files, and others figuring out these dependencies for you. Nx also stores the cached project graph, so it only reanalyzes the files you have changed.

![project-graph-updated](/shared/mental-model/project-graph-updated.png)

Nx provides an updated graph after each analysis is done.

## Metadata-driven

Everything in Nx comes with metadata to enable toolability. The default values, validations, autocompletion work, and more are all defined in a schema, instead of in code.

The following sample schema shows inputs, prompts, and validations for adding a new application.

```json
{
  "$schema": "http://json-schema.org/schema",
  "cli": "nx",
  "$id": "NxNextApp",
  "title": "Create an Application for Nx",
  "type": "object",
  "properties": {
    "name": {
      "description": "The name of the application.",
      "type": "string",
      "$default": {
        "$source": "argv",
        "index": 0
      },
      "x-prompt": "What name would you like to use for the application?",
      "pattern": "^[a-zA-Z].*$"
    },
    "directory": {
      "description": "The directory of the new application.",
      "type": "string",
      "alias": "d"
    },
    "style": {
      "description": "The file extension to be used for style files.",
      "type": "string",
      "default": "css",
      "alias": "s",
      "x-prompt": {
        "message": "Which stylesheet format would you like to use?",
        "type": "list",
        "items": [
          { "value": "css", "label": "CSS" },
          {
            "value": "scss",
            "label": "SASS(.scss)       [ http://sass-lang.com          ]"
          },
          {
            "value": "styl",
            "label": "Stylus(.styl)     [ http://stylus-lang.com        ]"
          },
          {
            "value": "less",
            "label": "LESS              [ http://lesscss.org            ]"
          }
        ]
      }
    },
    "linter": {
      "description": "The tool to use for running lint checks.",
      "type": "string",
      "enum": ["eslint", "tslint"],
      "default": "eslint"
    },
    "skipFormat": {
      "description": "Skip formatting files",
      "type": "boolean",
      "default": false
    },
    "skipWorkspaceJson": {
      "description": "Skip updating workspace.json with default options based on values provided to this app (e.g. babel, style)",
      "type": "boolean",
      "default": false
    },
    "unitTestRunner": {
      "type": "string",
      "enum": ["jest", "none"],
      "description": "Test runner to use for unit tests",
      "default": "jest"
    },
    "e2eTestRunner": {
      "type": "string",
      "enum": ["cypress", "none"],
      "description": "Test runner to use for end to end (e2e) tests",
      "default": "cypress"
    },
    "tags": {
      "type": "string",
      "description": "Add tags to the application (used for linting)",
      "alias": "t"
    },
    "js": {
      "type": "boolean",
      "description": "Generate JavaScript files rather than TypeScript files.",
      "default": false
    },
    "setParserOptionsProject": {
      "type": "boolean",
      "description": "Whether or not to configure the ESLint \"parserOptions.project\" option. We do not do this by default for lint performance reasons.",
      "default": false
    }
  },
  "required": []
}
```

This metadata is used by Nx itself, by VSCode and WebStorm integrations, by GitHub integration, and by third-party tools.

![metadata](/shared/mental-model/metadata.png)

These tools are able to implement richer experiences with Nx using this metadata.

## The task graph

Nx uses the project graph to create a task graph. Any time you run anything, Nx creates a task graph from the project graph and then executes the tasks in that graph.

For instance `nx test lib` creates a task graph with a single node:

![task-graph](/shared/mental-model/task-graph.png)

A task is an invocation of a target. If you invoke the same target twice, you create two tasks.

Nx uses the [project graph](#the-project-graph), but the task graph and project graph aren’t isomorphic, meaning they aren’t directly connected. In the case above, app1 and app2 depend on lib, but running `nx run-many --target=test --projects=app1,app2,lib`, the created task graph will look like this:

![task-graph-creation](/shared/mental-model/task-graph-creation.png)

Even though the apps depend on lib, testing `app1` doesn’t depend on the testing lib. This means that the two tasks can run in parallel.

Let’s look at the test target relying on its dependencies.

```json
{
  "test": {
    "executor": "@nrwl/jest:jest",
    "outputs": ["coverage/apps/app1"],
    "dependsOn": [{ "target": "test", "projects": "dependencies" }],
    "options": {
      "jestConfig": "apps/app1/jest.config.js",
      "passWithNoTests": true
    }
  }
}
```

With this, running the same test command creates the following task graph:

![task-graph-run](/shared/mental-model/task-graph-run.png)

This often makes more sense for builds, where to build app1, you want to build lib first. You can also define similar relationships between targets of the same project, including a test target that depends on the build.

A task graph can contain different targets, and those can run in parallel. For instance, as Nx is building `app2`, it can be testing `app1` at the same time. Learn more about configuring targets in the [configuration guide](/{{framework}}/core-concepts/configuration)

![task-graph-execution](/shared/mental-model/task-graph-execution.png)

Nx also runs the tasks in the task graph in the right order. Nx executing tasks being executed speeds up your overall execution time.

## Affected commands

When you run `nx test app1`, you are telling Nx to run the app1:test task plus all the tasks it depends on.

When you run `nx run-many --target=test --projects=app1,lib`, you are telling Nx to do the same for two tasks app1:test and lib:test.

When you run `nx run-many --target=test --all`, you are telling Nx to do this for all the projects.

As your workspace grows, retesting all projects becomes too slow. To address this Nx implements code change analysis to get the min set of projects that need to be retested. How does it work?

When you run `nx affected --target=test`, Nx looks at the files you changed in your PR, it will look at the nature of change (what exactly did you update in those files), and it uses this to figure the list of projects in the workspace that can be affected by this change. It then runs the `run-many` command with that list.

For instance, if my PR changes `lib`, and I then run `nx affected --target=test`, Nx figures out that `app1` and `app2` depend on `lib`, so it will invoke `nx run-many --target=test --projects=app1,app2,lib`.

![affected](/shared/mental-model/affected.png)

Nx analyzes the nature of the changes. For example, if you change the version of Next.js in the package.json, Nx knows that `app2` cannot be affected by it, so it only retests `app1`.

## Computation hashing and caching

Nx runs the tasks in the task graph in the right order. Before running the task, Nx computes its computation hash. As long as the computation hash is the same, the output of running the task is the same.

How does Nx do it?

By default, the computation hash for say `nx test app1` includes:

- All the source files of `app1` and `lib`
- Relevant global configuration
- Versions of externals dependencies
- Runtime values provisioned by the user such as the version of Node
- Command flags

![computation-hashing](/shared/mental-model/computation-hashing.png)

This behavior is customizable. For instance, lint checks may only depend on the source code of the project and global configs. Builds can depend on the dts files of the compiled libs instead of their source.

After Nx computes the hash for a task, it then checks if it ran this exact computation before. First, it checks locally, and then if it is missing, and if a remote cache is configured, it checks remotely.

If Nx finds the computation, Nx retrieves it and replay it. Nx places the right files in the right folders and prints the terminal output. So from the user’s point of view, the command ran the same, just a lot faster.

![cache](/shared/mental-model/cache.png)

If Nx doesn’t find this computation, Nx runs the task, and after it completes, it takes the outputs and the terminal output and stores it locally (and if configured remotely). All of this happens transparently, so you don’t have to worry about it.

Although conceptually this is fairly straightforward, Nx optimizes this to make this experience good for you. For instance, Nx:

- Captures stdout and stderr to make sure the replayed output looks the same, including on Windows.
- Minimizes the IO by remembering what files are replayed where.
- Only shows relevant output when processing a large task graph.
- Provides affordances for troubleshooting cache misses.
  And many other optimizations.

As your workspace grows, the task graph looks more like this:

![cache](/shared/mental-model/task-graph-big.png)

All of these optimizations are crucial for making Nx usable for any non-trivial workspace. Only the minimum amount of work happens. The rest is either left as is or restored from the cache.

In summary:

- Nx is able to analyze your source code to create a Project Graph.
- Nx can use the project graph and information about projects’ targets to create a Task Graph.
- Nx is able to perform code-change analysis to create the smallest task graph for your PR.
- Nx supports computation caching to never execute the same computation twice. This computation cache is pluggable and can be distributed.

## Learn more:

- [Migrating from Lerna to Nx: Better Dev Ergonomics + Much Faster Build Times](https://blog.nrwl.io/migrating-from-lerna-to-nx-better-dev-ergonomics-much-faster-build-times-da76ff14ccbb)
- [Using Generators](/{{framework}}/generators/using-schematics)
- [Using Executors](/{{framework}}/executors/using-builders)
