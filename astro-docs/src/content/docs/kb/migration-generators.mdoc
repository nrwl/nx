---
title: Migration Generators
description: Learn how to create migration generators for your Nx plugin to automatically update configuration files when your plugin makes breaking changes.
filter: 'type:Guides'
topics:
  - 'Extending Nx'
---

When your plugin is being used in other repos, it is helpful to provide migration generators to automatically update configuration files when your plugin makes a breaking change.

A migration generator is a normal generator that is triggered when a developer runs the `nx migrate` command.

## Create a migration generator

For this example, we'll create a new migration generator that updates repos to use `newExecutorName` instead of `oldExecutorName` in their targets. This migration will be applied when the run `nx migrate` to move up past version `2.0.1` of our plugin.

### 1. Generate a migration

```shell
nx generate @nx/plugin:migration libs/pluginName/src/migrations/change-executor-name \
 --name='Change Executor Name' \
 --packageVersion=2.0.1 \
 --project=pluginName \
 --description='Changes the executor name from oldExecutorName to newExecutorName'
```

This command will update the following files:

```json
// package.json
{
  "nx-migrations": {
    "migrations": "./migrations.json"
  }
}
```

```json
// migrations.json
{
  "generators": {
    "change-executor-name": {
      "version": "2.0.1",
      "description": "Changes the executor name from oldExecutorName to newExecutorName",
      "cli": "nx",
      "implementation": "./src/migrations/change-executor-name/change-executor-name"
    }
  }
}
```

And it creates a blank generator under: `libs/pluginName/src/migrations/change-executor-name/change-executor-name.ts`

### 2. write the generator code

```ts
// change-executor-name.ts
import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';

export function changeExecutorNameToNewName(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, project] of projects) {
    if (
      project.targets?.build?.executor === '@myorg/pluginName:oldExecutorName'
    ) {
      project.targets.build.executor = '@myorg/pluginName:newExecutorName';
      updateProjectConfiguration(tree, name, project);
    }
  }
}

export default changeExecutorNameToNewName;
```

## Return values

A migration can return nothing at all.
When it has something to report, return a [`MigrationReturnObject`](/docs/reference/devkit/MigrationReturnObject):

```ts
export default async function update(tree: Tree) {
  // ...
  return {
    nextSteps: ['Review the rewritten build target in apps/admin.'],
    agentContext: [
      'apps/admin/vite.config.ts spreads its plugin array, so the plugin list was left alone.',
    ],
  };
}
```

`nextSteps` is for the user running the migration.
Nx prints these in the end-of-run summary.
Returning a plain `string[]` is shorthand for this field on its own.

`agentContext` only reaches an AI agent.
With the agentic flow on, Nx hands these strings to the agent that runs a paired prompt or reviews what the generator changed, but only when that step actually runs.
When `nx migrate` itself runs inside an agent, they go to that agent instead.
Anything else drops them, so duplicate what the user needs into `nextSteps`.

### Skip the AI step

An entry with a generator half gets an AI step during an agentic run in one of two shapes.
A hybrid entry, one with both `implementation` and `prompt`, runs its prompt after the generator.
A generator-only entry that changed files gets a review pass unless you pass `--no-validate`.

Return `skipAgentic: true` when the deterministic run already handled everything, and Nx skips that step:

```ts
export default async function update(tree: Tree) {
  if (!tree.exists('eslint.config.js')) {
    // No flat config in this workspace, so there's nothing left for the prompt.
    return { skipAgentic: true };
  }
  // ...
}
```

The flag is opt-in and read strictly, so only a literal `true` skips anything and leaving it out keeps the behavior you have today.

For a hybrid entry it also drops the prompt from the end-of-run next steps.
That matters when the agentic flow is off, since Nx would otherwise tell the user to apply a prompt with no work left in it.
Don't return `agentContext` alongside it.
The two contradict each other, and Nx drops the context feeding the step it waived.

## Update package.json dependencies

If you just need to change dependency versions, you can add some configuration options to the `migrations.json` file without making a full generator.

```json
// migrations.json
{
  "packageJsonUpdates": {
    // this can be any name
    "12.10.0": {
      // this is version at which the change will be applied
      "version": "12.10.0-beta.2",
      "packages": {
        // the name of the dependency to update
        "@testing-library/react": {
          // the version to set the dependency to
          "version": "11.2.6",
          // When true, the dependency will be added if it isn't there.  When false, the dependency is skipped if it isn't already present.
          "alwaysAddToPackageJson": false
        }
      }
    }
  }
}
```
