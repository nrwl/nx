---
title: Add Language Support to Nx
description: 'Build an Nx plugin that brings multi-language support to your workspace, creating projects, tasks, and dependencies from configuration files, using Python and uv as the example.'
sidebar:
  order: 1
filter: 'type:Guides'
topics:
  - 'Extending Nx'
---

{% llm_copy_prompt title="Let an AI agent build the plugin" %}
Build an Nx plugin that adds support for my toolchain to this workspace, following the structure below.

1. Ask me the following before writing any code:
   - Which toolchain to support, and which manifest file marks a project (for example `pyproject.toml`, `go.mod`, `Cargo.toml`).
   - Which targets to infer, and the command behind each one.
   - How manifests declare dependencies on each other, by package name, by relative path, or both.
   - Roughly how many projects the workspace has.
   - Which Nx versions the plugin has to support, since the disk caching helpers live in a lower-stability entry point.
2. Check for a root `package.json`. The plugin is a Node package, so the generator has nothing to write to without one. If it is missing, initialize it with whichever package manager the repository already uses, or with `npm init -y` if there is no JavaScript in the repository at all. Do not run `npm init` against a manifest that already exists, because it rewrites fields such as `type` and `license`. Once the manifest is there, `nx init` installs Nx through the detected package manager, so no separate install step is needed.
3. Generate the plugin with `npx nx add @nx/plugin` and `npx nx g plugin packages/<plugin-name>`, in a directory the toolchain does not treat as a workspace member.
4. Export `createNodes` from the plugin entry point: glob the manifest, and for each match return a project with cacheable targets that run the toolchain's own commands. Return `{}` for a manifest that describes an aggregate root rather than a package, and infer only the targets each project can run.
5. Export `createDependencies`: map dependency declarations in the manifests to workspace projects and emit static dependencies.
6. Register the plugin in `nx.json`, then verify with `NX_DAEMON=false NX_CACHE_PROJECT_GRAPH=false nx show project <project-name> --json`, `nx graph --file=graph.json`, and one real run of every target you inferred.
7. Once the graph is correct, move on to the second phase and optimize it. Measure with `NX_PERF_LOGGING=true`, then work through the performant project graph plugins guide, including disk caching through `@nx/devkit/internal`. Tell me if the Nx version range from step 1 rules those helpers out.

Page: {pageUrl}
{% /llm_copy_prompt %}

Nx plugins package knowledge about a toolchain so every project doesn't need to recreate the same integration.
A plugin can contribute projects and tasks to the [project graph](/docs/features/explore-graph), dependencies between projects, [code generators](/docs/features/generate-code), and migrations.

{% aside type="note" title="You don't need a plugin to get started" %}
A [`project.json`](/docs/reference/project-configuration) file configures projects and tasks for any language without a plugin. A plugin lets Nx read the toolchain configuration files you already maintain instead.
{% /aside %}

A plugin that adds [multi-language support](/docs/features/multi-language-support) to a workspace does three things:

1. Declares a glob for the configuration files that mark a project (for example `**/pyproject.toml`).
2. Turns each matching file into a project with tasks (`createNodes`).
3. Connects projects with dependencies read from those files (`createDependencies`).

The examples below use Python projects managed with [uv](https://docs.astral.sh/uv/), but the same structure applies to any toolchain, so substitute your manifest and commands as you follow along.

## Set up a plugin

A plugin is a module that exports `createNodes` and, optionally, `createDependencies`.
It ships as a Node package, so the workspace needs a root `package.json` first.
Scaffold the plugin with:

{% tabs %}
{% tabitem label="In an existing Nx workspace" %}

```shell
npx nx add @nx/plugin
npx nx g plugin packages/nx-uv
```

{% /tabitem %}
{% tabitem label="In a repository without Nx" %}

```shell
# Only if there is no root package.json yet.
npm init -y

npx nx init
npx nx add @nx/plugin
npx nx g plugin packages/nx-uv
```

{% /tabitem %}
{% tabitem label="In a new plugin workspace" %}

```shell
npx create-nx-plugin nx-uv
```

{% /tabitem %}
{% /tabs %}

{% aside type="note" title="Watch for your toolchain's workspace globs" %}
Some toolchains claim directories through a member glob, and a TypeScript plugin dropped inside one breaks them.
A uv root that globs `packages/*` reports `missing a pyproject.toml` once the plugin lands in `packages/nx-uv`.
Exclude that path from the glob, or generate the plugin where the glob doesn't reach.
{% /aside %}

The plugin entry point exports the two functions, each tied to the glob and options you'll fill in over the next sections:

```ts
// packages/nx-uv/src/index.ts
import { CreateDependencies, CreateNodes } from '@nx/devkit';

// Options users can set in nx.json
export interface UvPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
}

// A tuple of the file glob and a function that creates projects and tasks
export const createNodes: CreateNodes<UvPluginOptions> = [
  '**/pyproject.toml',
  async (configFiles, options, context) => {
    // Covered in "Create projects and tasks"
  },
];

// Connects projects, reading the same configuration files
export const createDependencies: CreateDependencies<UvPluginOptions> = (
  options,
  context
) => {
  // Covered in "Create dependencies between projects"
};
```

Register the plugin in `nx.json` so Nx calls it when computing the project graph:

```jsonc
// nx.json
{
  "plugins": [
    {
      "plugin": "nx-uv",
      "options": {
        "buildTargetName": "build",
        "testTargetName": "test",
      },
    },
  ],
}
```

The `plugin` string must match the `name` in the plugin's `package.json`, so a scoped name like `@acme/nx-uv` works the same way.
The `options` object is passed to both functions, and its shape is yours to define.
First-party plugins use it to let users rename the targets the plugin creates.

## Choose which files to glob

The glob is the entry point for everything else.
Match the file that marks the root of a project in your toolchain, usually the manifest or configuration file the tool itself reads:

| Toolchain      | Files to glob       |
| -------------- | ------------------- |
| Python + uv    | `**/pyproject.toml` |
| Go             | `**/go.mod`         |
| Rust + Cargo   | `**/Cargo.toml`     |
| PHP + Composer | `**/composer.json`  |

Keep the glob narrow.
Matching `**/*.py` would call your plugin for every source file, while matching `**/pyproject.toml` calls it once per project.
Nx already ignores everything in `.gitignore` and `.nxignore` when resolving the glob.

## Create projects and tasks

`createNodes` is a tuple of the glob and a function that receives all matching files in one batch.
For each file, return the project it defines: the project root, a name, and the targets (tasks) that Nx should register.

Wrap your per-file logic in `createNodesFromFiles`, which handles fanning out over the batch and error reporting for you:

```ts
// packages/nx-uv/src/index.ts
import {
  createNodesFromFiles,
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
} from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'smol-toml'; // any TOML parser works

export const createNodes: CreateNodes<UvPluginOptions> = [
  '**/pyproject.toml',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      createNodesInternal,
      configFiles,
      options,
      context
    );
  },
];

function createNodesInternal(
  configFilePath: string,
  options: UvPluginOptions | undefined,
  context: CreateNodesContext
) {
  const projectRoot = dirname(configFilePath);
  const pyproject = parse(
    readFileSync(join(context.workspaceRoot, configFilePath), 'utf-8')
  );

  // A uv workspace root lists its members without declaring a package of its own.
  const name = pyproject.project?.name;
  if (!name) {
    return {};
  }

  const buildTargetName = options?.buildTargetName ?? 'build';
  const testTargetName = options?.testTargetName ?? 'test';

  const testTarget: TargetConfiguration = {
    command: 'uv run pytest',
    options: { cwd: projectRoot },
    cache: true,
    inputs: [
      '{projectRoot}/**/*.py',
      '{projectRoot}/pyproject.toml',
      '{workspaceRoot}/uv.lock',
    ],
    metadata: {
      technologies: ['python'],
      description: 'Run pytest via uv',
    },
  };

  const targets: Record<string, TargetConfiguration> = {
    [testTargetName]: testTarget,
  };

  // Only a project that declares a build backend can produce a distribution.
  if (pyproject['build-system']) {
    targets[buildTargetName] = {
      command: 'uv build --out-dir dist',
      options: { cwd: projectRoot },
      cache: true,
      inputs: ['{projectRoot}/**/*.py', '{projectRoot}/pyproject.toml'],
      outputs: ['{projectRoot}/dist'],
      metadata: {
        technologies: ['python'],
        description: 'Build a wheel and source distribution via uv',
      },
    };
  }

  return { projects: { [projectRoot]: { name, targets } } };
}
```

With this in place, `nx test <project-name>` runs pytest for any project that has a `pyproject.toml`, with caching configured once in the plugin instead of per project.
`nx build <project-name>` works the same way for the projects that declare a build backend.

A few things to know about the returned configuration:

- **The config file is the project marker.** For language plugins, the manifest marks the project, so there's no need to check for `project.json` or `package.json` the way JS tooling plugins do.
- **Read the manifest before inferring.** Manifests within one workspace are not uniform. A root that only aggregates members is not a project at all, plenty of projects have no build backend, and the project name can live in a toolchain-specific table rather than the standard one.
- **Targets are regular Nx targets.** `command`, `cache`, `inputs`, `outputs`, and `dependsOn` behave exactly as they do in `project.json`. Paths must start with `{projectRoot}` or `{workspaceRoot}`, and set `outputs` for tasks that produce files so Nx can restore them from cache. See the [inputs reference](/docs/reference/inputs) for details.
- **Consider the lockfile in `inputs`.** Hashing the lockfile (`uv.lock`, `go.sum`, `Cargo.lock`) re-runs tasks when dependency versions change, but any lockfile change busts the cache for every project. The built-in JS support avoids this by hashing only the external packages each project uses, which is worth copying if your lockfile churns often.
- **Returned configuration is merged, not final.** Users can override anything your plugin infers by adding a `project.json` file to the project or `targetDefaults` in `nx.json`. Plugin-inferred values have the lowest priority.
- **The `metadata` fields** show up in the project details view (`nx show project <project-name>`), which is where users debug what your plugin inferred.

## Create dependencies between projects

`createDependencies` tells Nx how projects relate.
`nx affected`, task ordering, and the graph visualization are only as accurate as these edges.
Read the dependency information your toolchain already has.
For uv workspaces, each member's `pyproject.toml` lists its dependencies by package name:

```toml
# packages/api/pyproject.toml
[project]
name = "api"
dependencies = ["shared-utils"]

[tool.uv.sources]
shared-utils = { workspace = true }
```

Map each package name to the Nx project that declares it, then emit a dependency for every match:

```ts
// packages/nx-uv/src/index.ts
import {
  DependencyType,
  RawProjectGraphDependency,
  validateDependency,
} from '@nx/devkit';

export const createDependencies: CreateDependencies<UvPluginOptions> = (
  options,
  context
) => {
  // Map python package names to nx project names
  const packageToProject = new Map<string, string>();
  const projectPyprojects = new Map<string, { config: any; path: string }>();

  for (const [projectName, project] of Object.entries(context.projects)) {
    const pyprojectPath = join(project.root, 'pyproject.toml');
    if (!existsSync(join(context.workspaceRoot, pyprojectPath))) {
      continue;
    }
    const config = parse(
      readFileSync(join(context.workspaceRoot, pyprojectPath), 'utf-8')
    );
    if (!config.project?.name) {
      continue;
    }
    packageToProject.set(config.project.name, projectName);
    projectPyprojects.set(projectName, { config, path: pyprojectPath });
  }

  const results: RawProjectGraphDependency[] = [];
  for (const [projectName, { config, path }] of projectPyprojects) {
    for (const dep of config.project.dependencies ?? []) {
      const target = packageToProject.get(dep);
      if (!target) continue; // external package, not a workspace project
      const dependency: RawProjectGraphDependency = {
        source: projectName,
        target,
        sourceFile: path,
        type: DependencyType.static,
      };
      validateDependency(dependency, context);
      results.push(dependency);
    }
  }
  return results;
};
```

{% aside type="note" title="Dependencies declared by path" %}
Some toolchains point at a sibling directory instead of naming a package, as a Poetry path dependency does.
Resolve those against the directory of the manifest that declares them, then match the result to a project root.
{% /aside %}

Manifest files like `pyproject.toml`, `go.mod`, or `Cargo.toml` cover most toolchains, since the dependency information is already written down in one place per project.
If your language only expresses dependencies through import statements in source code, parse those files instead, and use `context.filesToProcess` to limit the work to files that changed since the last graph computation.

Accurate parsing is often easier in the language itself than in TypeScript.
The first-party Gradle, Maven, and .NET plugins all spawn the toolchain once for the whole workspace, have it write a JSON report of projects and dependencies, and build both nodes and dependencies from that report.
Nx always calls `createNodes` before `createDependencies`, so the report can be produced once and shared between the two.

## Verify your plugin

While developing, two environment variables matter:

```shell
# The daemon caches plugin code, so restart it to pick up changes.
NX_DAEMON=false NX_CACHE_PROJECT_GRAPH=false npx nx show projects
```

Check the results of your plugin directly:

- `nx show project <project-name> --json` prints the full inferred configuration, including targets your plugin created.
- `nx graph --file=graph.json` writes the projects and the dependencies you emitted to a file rather than opening a browser, which works over SSH and in CI. Pass an `.html` path for the interactive view.
- `nx <target> <project-name>` runs a target you inferred. Run one of every kind you created, because a target that reads correctly in `nx show project` can still fail the moment its command executes.

For automated coverage, call your functions directly in a unit test with a fixture directory as the workspace root, and snapshot the returned projects and dependencies:

```ts
// packages/nx-uv/src/index.spec.ts
import { createNodes } from './index';

const [, createNodesFn] = createNodes;

it('creates a project for each pyproject.toml', async () => {
  const results = await createNodesFn(
    ['packages/api/pyproject.toml'],
    { testTargetName: 'test' },
    { workspaceRoot: fixtureDirectory, nxJsonConfiguration: {} }
  );

  expect(results).toMatchSnapshot();
});
```

The first-party plugins that spawn an external tool mock that step in unit tests and feed in a recorded report fixture, so the tests stay fast and deterministic.
Plugins scaffolded with `create-nx-plugin` also include an e2e setup that publishes the plugin to a local registry, installs it into a fresh workspace, and asserts on `nx show project --json` output.

## Optimize graph creation

`createNodes` runs before every task, so measure what your plugin costs once the graph is correct:

```shell
NX_PERF_LOGGING=true NX_DAEMON=false npx nx show projects
```

Nx prints a timing per step, including `<plugin-name>:createNodes` and `Load Nx Plugin: <plugin-name>`.
Keep the daemon off, or the plugin timings never reach your terminal.

From there, work through the patterns that bring those numbers down:

- Cache computed targets to disk. This uses a handful of helpers from `@nx/devkit/internal`, which nearly every
  first-party plugin depends on. They sit at a lower stability tier than `@nx/devkit` and can change between
  versions, and some will be promoted to the public API later.
- Load and parse the manifests in one parallel batch.
- Keep the configuration you return deterministic.
- Keep top-level imports light.

[Write a performant project graph plugin](/docs/kb/performant-project-graph-plugins) has the code for each.
