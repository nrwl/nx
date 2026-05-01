---
title: Migrate `nx` imports to `@nx/devkit`
description: The `nx` package is the CLI, not a public import surface. Move plugin and script imports to `@nx/devkit` so they keep working in future major versions.
sidebar:
  label: Migrate `nx` imports to `@nx/devkit`
filter: 'type:Guides'
---

{% llm_copy_prompt title="Migrate `nx` imports to `@nx/devkit`" %}
Audit this workspace for TypeScript/JavaScript imports from the `nx` package (the CLI) and rewrite them to import from `@nx/devkit` instead.

1. Search every `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs` file for imports from `'nx'` or any `'nx/...'` subpath (e.g. `'nx/src/...'`, `'nx/devkit'`). Include `import` statements, `require(...)` calls, and dynamic `import(...)` expressions.
2. For each match, check whether the named export is part of the `@nx/devkit` public API at https://nx.dev/docs/reference/devkit. Common public API members include `Tree`, `ExecutorContext`, `ProjectConfiguration`, `NxJsonConfiguration`, `ProjectGraph`, `Task`, `TaskGraph`, `createProjectGraphAsync`, `readCachedProjectGraph`, `workspaceRoot`, `readJsonFile`, `writeJsonFile`, `readJson`, `writeJson`, `updateJson`, `joinPathFragments`, `normalizePath`, `logger`, `output`, `getPackageManagerCommand`, `detectPackageManager`, `parseTargetString`, `targetToTargetString`, `readTargetOptions`, `runExecutor`.
3. Rewrite the import so the symbol comes from `@nx/devkit`. If several symbols from the same file are all public devkit API, consolidate them into one `import { ... } from '@nx/devkit';` statement.
4. If a symbol is NOT listed in the devkit public API, do not guess a replacement. Flag it in the final report with the file path, the symbol name, and the original import path.
5. For imports found in test files (`*.spec.ts`, `*.test.ts`, `test-setup.ts`) that reference testing helpers like `createTreeWithEmptyWorkspace`, use the `@nx/devkit/testing` entry point instead of `@nx/devkit`.
6. For imports found in Angular plugin code that reference `nx/src/adapter/...`, use `@nx/devkit/ngcli-adapter` instead.
7. Ensure `@nx/devkit` is declared as a dependency (or `devDependency` / `peerDependency` where appropriate) in the nearest `package.json`. Add it if missing.
8. Do not change behavior. Only move the import source. Do not widen or narrow type annotations.
9. Produce a summary at the end listing: files changed, symbols migrated, and any symbols that could not be migrated (so the user can file an issue at https://github.com/nrwl/nx/issues/new).

Reference: {pageUrl}
{% /llm_copy_prompt %}

`@nx/devkit` is the package that exports programmatic utils when working with Nx. The `nx` package is the CLI. It isn't a stable import surface.

In a future major version, the `nx` package will stop exporting these symbols. Any code that imports from `nx`, whether from the package root or from deep paths like `nx/src/...`, will break. Migrating now is a one-line-per-import change and keeps your code forward-compatible.

## What goes where

| Package      | Purpose                                                                          |
| ------------ | -------------------------------------------------------------------------------- |
| `nx`         | The CLI binary (`nx ...`, `npx nx ...`). Not meant to be imported.               |
| `@nx/devkit` | The public API for plugin authors, generators, executors, and workspace scripts. |

Browse the full [DevKit API here](/docs/reference/devkit).

## Before and after

### Project graph

```ts
// ❌ Before: imports from the CLI package
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph';
import type { ProjectGraph } from 'nx/src/config/project-graph';

export async function listProjects(): Promise<string[]> {
  const graph: ProjectGraph = await createProjectGraphAsync();
  return Object.keys(graph.nodes);
}
```

```ts
// ✅ After: imports from the public devkit API
import { createProjectGraphAsync, ProjectGraph } from '@nx/devkit';

export async function listProjects(): Promise<string[]> {
  const graph: ProjectGraph = await createProjectGraphAsync();
  return Object.keys(graph.nodes);
}
```

### Generator

```ts
// ❌ Before
import type { Tree } from 'nx/src/generators/tree';
import {
  addProjectConfiguration,
  readProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import { readNxJson } from 'nx/src/generators/utils/project-configuration';

export default async function (tree: Tree, schema: { project: string }) {
  const nxJson = readNxJson(tree);
  const project = readProjectConfiguration(tree, schema.project);
  // ...
}
```

```ts
// ✅ After
import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
  readNxJson,
  formatFiles,
} from '@nx/devkit';

export default async function (tree: Tree, schema: { project: string }) {
  const nxJson = readNxJson(tree);
  const project = readProjectConfiguration(tree, schema.project);
  // ...
  await formatFiles(tree);
}
```

### Executor

```ts
// ❌ Before
import type { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { workspaceRoot } from 'nx/src/utils/workspace-root';

export default async function runExecutor(
  options: { script: string },
  context: ExecutorContext
) {
  console.log(`Running from ${workspaceRoot}`);
  // ...
  return { success: true };
}
```

```ts
// ✅ After
import { ExecutorContext, workspaceRoot } from '@nx/devkit';

export default async function runExecutor(
  options: { script: string },
  context: ExecutorContext
) {
  console.log(`Running from ${workspaceRoot}`);
  // ...
  return { success: true };
}
```

### JSON utilities and logging

```ts
// ❌ Before
import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';
import { logger } from 'nx/src/utils/logger';
```

```ts
// ✅ After
import { readJsonFile, writeJsonFile, logger } from '@nx/devkit';
```

## Common symbols you should move

All of the following are part of the `@nx/devkit` public API. If you are importing them from `nx` today, move them.

| Symbol                                                                                             | Category        |
| -------------------------------------------------------------------------------------------------- | --------------- |
| `Tree`, `FileChange`                                                                               | Tree            |
| `ProjectConfiguration`, `ProjectsConfigurations`, `TargetConfiguration`, `ProjectType`             | Workspace       |
| `NxJsonConfiguration`, `PluginConfiguration`, `TargetDefaults`                                     | Workspace       |
| `Generator`, `GeneratorCallback`, `Executor`, `ExecutorContext`, `PromiseExecutor`                 | Workspace       |
| `Task`, `TaskGraph`, `TaskResult`, `TaskResults`                                                   | Tasks           |
| `ProjectGraph`, `ProjectGraphDependency`, `ProjectGraphProjectNode`, `DependencyType`              | Project graph   |
| `createProjectGraphAsync`, `readCachedProjectGraph`, `readProjectsConfigurationFromProjectGraph`   | Project graph   |
| `NxPlugin`, `CreateNodesV2`, `CreateDependencies`, `createNodesFromFiles`                          | Plugins         |
| `addProjectConfiguration`, `readProjectConfiguration`, `updateProjectConfiguration`, `getProjects` | Generators      |
| `readNxJson`, `updateNxJson`, `readJson`, `writeJson`, `updateJson`                                | Generators      |
| `formatFiles`, `generateFiles`, `visitNotIgnoredFiles`, `names`, `offsetFromRoot`                  | Generators      |
| `parseTargetString`, `targetToTargetString`, `readTargetOptions`, `runExecutor`                    | Executors       |
| `workspaceRoot`, `cacheDir`, `joinPathFragments`, `normalizePath`                                  | Utils           |
| `readJsonFile`, `writeJsonFile`, `parseJson`, `serializeJson`, `stripJsonComments`                 | Utils           |
| `logger`, `output`, `stripIndents`                                                                 | Utils           |
| `defaultTasksRunner`, `DefaultTasksRunnerOptions`, `RemoteCache`                                   | Task runner     |
| `getPackageManagerCommand`, `detectPackageManager`, `getPackageManagerVersion`, `PackageManager`   | Package manager |
| `addDependenciesToPackageJson`, `removeDependenciesFromPackageJson`, `ensurePackage`, `NX_VERSION` | Utils           |

This is not exhaustive. The authoritative list lives in the [devkit API reference](/docs/reference/devkit).

## Testing utilities

If you import test helpers like `createTreeWithEmptyWorkspace` or `readProjectConfiguration` in tests, use the `@nx/devkit/testing` entry point:

```ts
// ✅
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
```

## Angular adapter

If you have a plugin that bridges the Angular CLI, use the `@nx/devkit/ngcli-adapter` entry point instead of reaching into `nx/src/adapter/...`:

```ts
// ✅
import { NxScopedHost } from '@nx/devkit/ngcli-adapter';
```

## Add `@nx/devkit` as a dependency

Run the package manager command for your workspace:

{% tabs syncKey="package-manager" %}
{% tabitem label="npm" %}

```shell
npm install --save-dev @nx/devkit
```

{% /tabitem %}
{% tabitem label="yarn" %}

```shell
yarn add --dev @nx/devkit
```

{% /tabitem %}
{% tabitem label="pnpm" %}

```shell
pnpm add --save-dev @nx/devkit
```

{% /tabitem %}
{% tabitem label="bun" %}

```shell
bun add --dev @nx/devkit
```

{% /tabitem %}
{% /tabs %}

For published plugins, declare `@nx/devkit` as a `peerDependency` so it resolves against the consumer's installed Nx version.

## What if the symbol isn't in `@nx/devkit`?

Some `nx` exports are intentionally private. The `nx/src/devkit-internals` module is an example: it exists to let `@nx/devkit` bridge to internal Nx code, and it is **not** part of the public API. If a symbol you use lives there (or in any other `nx/src/...` path that isn't re-exported by `@nx/devkit`), don't move it to `@nx/devkit` and don't keep depending on the deep path long-term. It can change between minor versions.

Instead, [open an issue on GitHub](https://github.com/nrwl/nx/issues/new) describing:

- the symbol you need
- the `nx` subpath you're importing it from today
- the use case (plugin, script, migration, etc.)

We'll decide whether to promote it to the public API.
