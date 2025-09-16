---
title: Create a Sync Generator
description: Learn how to create and register sync generators in Nx to ensure your file system is in the correct state before tasks run, including global and task-specific sync generators.
---

# Create a Sync Generator

Sync generators are generators that are used to ensure that your file system is in the correct state before a task is run or the CI process is started. From a technical perspective, a sync generator is no different from any other generator, but it has some additional performance considerations and needs to be registered in a particular way.

{% callout type="warning" title="Disable the Nx Daemon during development" %}
When developing the Nx sync generator, disable the [Nx Daemon](/concepts/nx-daemon) by setting `NX_DAEMON=false`. The daemon caches your plugin code, so changes to your plugin won't be reflected until the daemon restarts.
{% /callout %}

## Create a new Sync Generator

You can create a new sync generator by hand or use the built-in generator that Nx provides via the `@nx/plugin` package.

### Step 1: Add @nx/plugin

Make sure you have `@nx/plugin` installed or add it to your workspace:

```shell
nx add @nx/plugin
```

### Step 2: Create a local plugin

Create a new local plugin where we can add our new sync generator. You can also add it to an existing local plugin if you already have one. In that case you can skip this step.

```shell
nx g @nx/plugin:plugin tools/my-plugin
```

### Step 3: Scaffold a new sync generator

Create a sync generator the same way you would [create any generator](/extending-nx/recipes/local-generators).

```shell
nx g @nx/plugin:generator --path=tools/my-plugin/src/generators/my-sync-generator
```

## Implement a Global Sync Generator

Global sync generators are executed when the `nx sync` or `nx sync:check` command is explicitly run by a user or in a script. They are not associated with an individual task or project and typically update root-level configuration files.

A sync generator should be able to run without any required options, so update the schema accordingly:

```jsonc {% fileName="tools/my-plugin/src/generators/my-sync-generator/schema.json" %}
{
  "$schema": "https://json-schema.org/schema",
  "$id": "MySyncGenerator",
  "title": "",
  "type": "object",
  "properties": {},
  "required": []
}
```

Also update the TypeScript interface to match:

```ts {% fileName="tools/my-plugin/src/generators/my-sync-generator/schema.d.ts" %}
export interface MySyncGeneratorSchema {}
```

Sync generators can optionally return an `outOfSyncMessage` to display to users when the sync generator needs to be run.

```ts {% fileName="tools/my-plugin/src/generators/my-sync-generator/my-sync-generator.ts" %}
import { Tree } from '@nx/devkit';
import { SyncGeneratorResult } from 'nx/src/utils/sync-generators';

export async function mySyncGenerator(
  tree: Tree
): Promise<SyncGeneratorResult> {
  if (
    !tree.exists('/legal-message.txt') ||
    tree.read('/legal-message.txt').toString() !==
      'This is an important legal message.'
  ) {
    tree.write('/legal-message.txt', 'This is an important legal message.');
  }
  return {
    outOfSyncMessage: 'The legal-message.txt file needs to be created',
  };
}

export default mySyncGenerator;
```

### Register a Global Sync Generator

Global sync generators are registered in the `nx.json` file like this:

```jsonc {% fileName="nx.json" %}
{
  "sync": {
    "globalGenerators": ["my-plugin:my-sync-generator"]
  }
}
```

{% callout type="warning" title="Verify the name of your plugin" %}
You might have to adjust the name of your plugin based on your specific workspace scope. Verify the name in `tools/my-plugin/package.json`. If the name there is `@myorg/my-plugin` you have to register it as:

```
{
  "syncGenerators": ["@myorg/my-plugin:my-sync-generator"]
}
```

{% /callout %}

Now `my-sync-generator` will be executed any time the `nx sync` command is run.

## Implement a Task Sync Generator that Uses the Project Graph

Task sync generators are run before a particular task and are used to ensure that the files are in the correct state for the task to be run. The primary use case for this is to set up configuration files based on the project graph. To read from the project graph, use the [`createProjectGraphAsync`](/reference/core-api/devkit/documents/createProjectGraphAsync) from the `@nx/devkit` package. Create a generator in the same way as a global sync generator and then read the project graph like this:

```ts {% fileName="tools/my-plugin/src/generators/my-sync-generator/my-sync-generator.ts" %}
import { Tree, createProjectGraphAsync, joinPathFragments } from '@nx/devkit';
import { SyncGeneratorResult } from 'nx/src/utils/sync-generators';

export async function mySyncGenerator(
  tree: Tree
): Promise<SyncGeneratorResult> {
  const projectGraph = await createProjectGraphAsync();
  Object.values(projectGraph.nodes).forEach((project) => {
    tree.write(
      joinPathFragments(project.data.root, 'license.txt'),
      `${project.name} uses the Acme Corp license.`
    );
  });
  return {
    outOfSyncMessage: 'Some projects are missing a license.txt file.',
  };
}

export default mySyncGenerator;
```

### Register a Task Sync Generator

To register a generator as a sync generator for a particular task, add the generator to the `syncGenerators` property of the task configuration.

{% callout type="info" title="Important: Package.json Configuration" %}
For projects using [inferred targets](/concepts/inferred-tasks) (no project.json file), the sync generators must be registered inside the `nx` property in package.json, not at the root level.
{% /callout %}

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="apps/my-app/package.json" %}
{
  "name": "my-app",
  ...
  "nx": {
    "targets": {
      "build": {
        "syncGenerators": ["my-plugin:my-sync-generator"]
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="apps/my-app/project.json" %}
{
  "targets": {
    "build": {
      "syncGenerators": ["my-plugin:my-sync-generator"]
    }
  }
}
```

{% /tab %}
{% /tabs %}

{% callout type="warning" title="Verify the name of your plugin" %}
You might have to adjust the name of your plugin based on your specific workspace scope. Verify the name in `tools/my-plugin/package.json`. If the name there is `@myorg/my-plugin` you have to register it as:

```
{
  "syncGenerators": ["@myorg/my-plugin:my-sync-generator"]
}
```

{% /callout %}

With this configuration in place, running `nx build my-app` will first run `my-sync-generator` and then run the `build` task. The `my-sync-generator` and any other task or global sync generators will be run when `nx sync` or `nx sync:check` is run.

## Performance and DX Considerations

Task sync generators will block the execution of the task while they are running and both global and task sync generators will block the CI pipeline until the `nx sync:check` command finishes. Because of this, make sure to keep in mind the following performance tips:

- Make the generator idempotent. Running the generator multiple times in a row should have the same impact as running the generator a single time.
- Only write to the file system when a file is actually changed. Avoid reformatting files that have not been actually modified. Nx will identify the workspace as out of sync if there's any file change after the sync generator is run.
- Make sure to provide an informative `outOfSyncMessage` so that developers know what to do to unblock their tasks.

Do whatever you can to make your sync generators as fast and user-friendly as possible, because users will be running them over and over again without even realizing it.
