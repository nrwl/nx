# Create a Sync Generator

Sync generators are generators that are used to ensure that your file system is in the correct state before a task is run or the CI process is started. From a technical perspective, a sync generator is no different from any other generator, but it has some additional performance considerations and needs to be registered in a particular way.

## Create a Generator

Create a sync generator the same way you would [create any generator](/extending-nx/recipes/local-generators):

```shell
nx g my-sync-generator --directory=tools/my-plugin/src/generators/my-sync-generator
```

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

## Use the Project Graph

One of the benefits of sync generators is that you can keep configuration files up to date with your project graph.

## Performance and DX Considerations

When writing a sync generator, it is important to remember that this generator is going to block the execution of its associated task and any tasks that depend on that task. Because of this fact, make sure to follow the following performance tips:

- Make the generator idempotent. Running the generator multiple times in a row should have the same impact as running the generator a single time.
- Only write to the file system when a file is actually changed. Avoid reformatting files that have not been actually modified. Nx will identify the workspace as out of sync if there's any file change after the sync generator is run.
- Make sure to provide an informative `outOfSyncMessage` so that developers know what to do to unblock their tasks.

Do whatever you can to make your sync generators as fast and user-friendly as possible, because users will be running them over and over again without even realizing it.

## Register a Sync Generator

There are two types of sync generators, task sync generators and global sync generators.

### Task Sync Generators

To register a generator as a sync generator for a particular task, add the generator to the `syncGenerators` property of the task configuration:

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="apps/my-app/package.json" %}
{
  "targets": {
    "build": {
      "syncGenerators": ["my-plugin:my-sync-generator"]
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

With this configuration in place, running `nx build my-app` will first run `my-sync-generator` and then run the `build` task. The `my-sync-generator` and any other task or global sync generators will be run when `nx sync` or `nx sync:check` is run.

### Global Sync Generators

Global sync generators are not associated with a particular task and are executed only when the `nx sync` or `nx sync:check` command is explicitly run. They are registered in the `nx.json` file like this:

```jsonc {% fileName="project.json" %}
{
  "sync": {
    "globalGenerators": ["my-plugin:my-sync-generator"]
  }
}
```

Now `my-sync-generator` will be executed any time the `nx sync` command is run.
