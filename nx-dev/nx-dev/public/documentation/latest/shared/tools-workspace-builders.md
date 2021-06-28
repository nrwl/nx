# Creating Custom Executors

Creating Executors for your workspace standardizes scripts that are run during your development/building/deploying tasks in order to enable Nx's `affected` command and caching capabilities.

This guide shows you how to create, run, and customize executors within your Nx workspace. The examples use the trivial use-case of an `echo` command.

## Creating an executor

The best way to create an executor is to use the `@nrwl/nx-plugin` package.

```bash
nx g @nrwl/nx-plugin:plugin local
```

This creates a plugin for you named `local`. If you already have a plugin in your workspace, use the `@nrwl/nx-plugin:executor` generator to add a new executor to it.

Your file system should look like this now:

```treeview
happynrwl/
├── apps/
├── libs/
│   ├── local/
│   │   └── src/
│   │       └── executors/
│   │           └── build/
│   │               ├── executor.spec.ts
│   │               ├── executor.ts
│   │               ├── schema.d.ts
│   │               └── schema.json
│   └── executors.json
├── tools/
├── nx.json
├── package.json
└── tsconfig.base.json
```

### schema.json

This file describes the options being sent to the executor (very similar to the `schema.json` file of generators). Setting the `cli` property to `nx` indicates that you're using the Nx Devkit to make this executor.

```json
{
  "$schema": "http://json-schema.org/schema",
  "type": "object",
  "cli": "nx",
  "properties": {
    "textToEcho": {
      "type": "string",
      "description": "Text To Echo"
    }
  }
}
```

This example describes a single option for the executor that is a `string` called `textToEcho`. When using this executor, specify a `textToEcho` property inside the options.

In the `executor.ts` file, you create an `Options` interface that matches the JSON object described here.

### executor.ts

The `executor.ts` contains the actual code for your executor. Your executor's implementation must export a function that takes an options object and returns a `Promise<{ success: boolean }>`.

```typescript
import { ExecutorContext } from '@nrwl/devkit';
import { exec } from 'child_process';
import { promisify } from 'util';

export interface EchoExecutorOptions {
  textToEcho: string;
}

export default async function echoExecutor(
  options: EchoExecutorOptions,
  context: ExecutorContext
) {
  console.info(`Executing "echo"...`);
  console.info(`Options: ${JSON.stringify(options, null, 2)}`);

  const { stdout, stderr } = await promisify(exec)(
    `echo ${options.textToEcho}`
  );
  console.log(stdout);
  console.error(stderr);

  const success = !!stderr;
  return { success };
}
```

### executors.json

The `executors.json` file provides the description of your executor to the CLI.

```json
{
  "executors": {
    "build": {
      "implementation": "./src/executors/build/executor",
      "schema": "./src/executors/build/schema.json",
      "description": "Runs `echo` (to test executors out)."
    }
  }
}
```

Note that this `executors.json` file is naming our executor 'echo' for the CLI's purposes, and mapping that name to the given implementation file and schema.

## Compiling and Running your Executor

After your files are created, build your plugin:

```bash
nx build local
```

This will compile your plugin to the `dist` folder, so that it can be used by the cli.

Our last step is to add this executor to a given project’s `targets` object in your project's `workspace.json` or `angular.json` file. The example below adds this executor to a project named 'platform':

```json
{
  //...
  "projects": {
    "platform": {
      //...
      "targets": {
        "build": {
          // ...
        },
        "serve": {
          // ...
        },
        "lint": {
          // ,,,
        },
        "echo": {
          "executor": "./dist/libs/local:build",
          "options": {
            "textToEcho": "Hello World"
          }
        }
      }
    }
  }
}
```

Note that the format of the `executor` string here is: `${Path to directory containing the executor's package.json}:${executor name}`.

Finally, you run the executor via the CLI as follows:

```bash
nx run platform:echo
```

To which we'll see the console output:

```bash
> nx run platform:echo
Executing "build"...
Options: {
  "textToEcho": "Hello World"
}
Hello World
```

## Adding a Postinstall Hook

In order to make the experience seamless for other developers, we need to add a postinstall hook to automatically build the plugin so that it can be used.

```json
{
  "scripts": {
    "postinstall": "nx build local"
  }
}
```

This will automatically build the `local` plugin when a developer installs `node_modules`.

## Debugging Executors

As part of Nx's computation cache process, Nx forks the node process, which can make it difficult to debug an executor command. Follow these steps to debug an executor:

1. Use VS Code's command pallette to open a `Javascript Debug Terminal`
2. Find the compiled (`*.js`) executor code and set a breakpoint.
3. Run the executor in the debug terminal

```bash
nx run platform:build
```

## Using Node Child Process

[Node’s `childProcess`](https://nodejs.org/api/child_process.html) is often useful in executors.

Part of the power of the executor API is the ability to compose executors via existing targets. This way you can combine other executors from your workspace into one which could be helpful when the process you’re scripting is a combination of other existing executors provided by the CLI or other custom executors in your workspace.

Here's an example of this (from a hypothetical project), that serves an api (project name: "api") in watch mode, then serves a frontend app (project name: "web-client") in watch mode:

```typescript
import { ExecutorContext, runExecutor } from '@nrwl/devkit';

export interface MultipleExecutorOptions {}

export default async function multipleExecutor(
  options: MultipleExecutorOptions,
  context: ExecutorContext
) {
  const result = await Promise.race([
    await runExecutor(
      { project: 'api', target: 'serve' },
      { watch: true },
      context
    ),
    await runExecutor(
      { project: 'web-client', target: 'serve' },
      { watch: true },
      context
    ),
  ]);
  for await (const res of result) {
    if (!res.success) return res;
  }

  return { success: true };
}
```

For other ideas on how to create your own executors, you can always check out Nx's own open-source executors as well!

(For example, our [cypress executor](https://github.com/nrwl/nx/blob/master/packages/cypress/src/executors/cypress/cypress.impl.ts))
