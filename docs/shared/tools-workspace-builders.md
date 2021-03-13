# Creating Nx Executors or Angular Devkit Builders in Your Nx Workspace

Creating Nx Executors/Angular Devkit Builders for your workspace standardizes scripts that are run during your development/building/deploying tasks in order to enable Nx's `affected` command and caching capabilities.

This guide will show you how to create, run, and customize executors/builders within your Nx workspace. In the examples, we'll use the trivial use-case of an `echo` command.

## Creating a Builder with @angular-devkit

> Note: In this article, we'll refer to executors that use the `@angular-devkit` as Angular Devkit Builders.

Your executor should be created within the `tools` directory of your Nx workspace like so:

```treeview
happynrwl/
├── apps/
├── libs/
├── tools/
│   └── executors/
│       └── echo/
│           ├── builder.json
│           ├── impl.ts
│           ├── package.json
│           └── schema.json
├── nx.json
├── package.json
└── tsconfig.json
```

### schema.json

This file will describe the options being sent to the builder (very similar to the `schema.json` file of generators).

```json
{
  "$schema": "http://json-schema.org/schema",
  "type": "object",
  "properties": {
    "textToEcho": {
      "type": "string",
      "description": "Text To Echo"
    }
  }
}
```

This example describes a single option for the builder that is a `string` called 'textToEcho'. When using this builder, we'll specify a 'textToEcho' property inside the options.

In our `impl.ts` file, we're creating an `Options` interface that matches the json object being described here.

### impl.ts

The `impl.ts` contains the actual code for your builder. Your builder should use the `createBuilder` function of the `@angular-devkit/architect` package to create a builder that can be run via the Nx CLI tools.

```typescript
import { BuilderOutput, createBuilder } from '@angular-devkit/architect';
import * as childProcess from 'child_process';
import { Observable } from 'rxjs';
import { json } from '@angular-devkit/core';

interface Options extends json.JsonObject {
  textToEcho: string;
}

export default createBuilder((_options: Options, context) => {
  context.logger.info(`Executing "echo"...`);
  context.logger.info(`Options: ${JSON.stringify(_options, null, 2)}`);
  const child = childProcess.spawn('echo', [_options.textToEcho]);
  return new Observable<BuilderOutput>((observer) => {
    child.stdout.on('data', (data) => {
      context.logger.info(data.toString());
    });
    child.stderr.on('data', (data) => {
      context.logger.error(data.toString());
    });
    child.on('close', (code) => {
      context.logger.info(`Done.`);
      observer.next({ success: code === 0 });
      observer.complete();
    });
  });
});
```

See the [official Angular documentation on builders](https://angular.io/guide/cli-builder) for more clarification on creating builders.

Also note that [Node’s `childProcess`](https://nodejs.org/api/child_process.html) is likely to be used in most cases.

Part of the power of the architect API is the ability to compose builders via existing build targets. This way you can combine other builders from your workspace into one which could be helpful when the process you’re scripting is a combination of other existing builders provided by the CLI or other custom-builders in your workspace.

Here's an example of this (from a hypothetical project), that will serve an api (project name: "api") in watch mode, then serve a frontend app (project name: "web-client") in watch mode:

```typescript
import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { concat } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
interface Options extends json.JsonObject {}

export default createBuilder((_options: Options, context: BuilderContext) => {
  return concat(
    scheduleTargetAndForget(
      context,
      targetFromTargetString('api:serve'),
      { watch: true }
    ),
    scheduleTargetAndForget(
      context,
      targetFromTargetString('web-client:serve'),
      { watch: true }
    )
  ).pipe(
    map(([apiBuilderContext, webClientBuilderContext]) =>
      ({ success: apiBuilderContext.success && webClientBuilderContext.success})
    )
  );
```

For other ideas on how to create your own builders, you can always check out Nx's own open-source builders as well!

(e.g. our [cypress builder](https://github.com/nrwl/nx/blob/master/packages/cypress/src/builders/cypress/cypress.impl.ts))

### builder.json

The `builder.json` file provides the description of your builder to the CLI.

```json
{
  "builders": {
    "echo": {
      "implementation": "./impl",
      "schema": "./schema.json",
      "description": "Runs `echo` (to test builders out)."
    }
  }
}
```

Note that this `builder.json` file is naming our builder 'echo' for the CLI's purposes, and mapping that name to the given implementation file and schema.

### package.json

This is all that’s required from the `package.json` file:

```json
{
  "builders": "./builder.json"
}
```

## Creating an Nx Executor

Creating an Nx Executor is in principle nearly identical to the Angular Devkit Builder example in the section above, we'll explain in this section the few differences involved.

### Marking the Executor as an Nx Executor

The first difference to adjust is to mark the executor as an Nx Executor in the schema. To do this, we'll need to add the `cli` property to the builder's schema, and give it the value `"nx"`:

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

### Implementing an Executor Without the Angular Devkit

Your executor's implementation must consist of a function that takes an options object and returns a `Promise<{ success: boolean }>`. Given the echo implementation provided in the Angular Devkit Builder section above, our Nx executor would look like this:

```typescript
import * as childProcess from 'child_process';

interface Options {
  textToEcho: string;
}

export default async function (
  _options: Options
): Promise<{ success: boolean }> {
  const child = childProcess.spawn('echo', [_options.textToEcho]);
  return new Promise<{ success: boolean }>((res) => {
    child.on('close', (code) => {
      res({ success: code === 0 });
    });
  });
}
```

## Compiling and Running your Builder

After your files are created, you can compile your builder with `tsc` (which should be available as long as you've installed Typescript globally: `npm i -g typescript`):

```sh
tsc tools/builders/echo/impl
```

This will create the `impl.js` file in your file directory, which will serve as the artifact used by the CLI.

Our last step is to add this builder to a given project’s `architect` object in your project's `workspace.json` or `angular.json` file. The example below adds this builder to a project named 'platform':

```json
{
  //...
  "projects": {
    "platform": {
      //...
      "architect": {
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
          "executor": "./tools/builders/echo:echo",
          "options": {
            "textToEcho": "Hello World"
          }
        }
      }
    }
  }
}
```

Note that the format of the `executor` string here is: `${Path to directory containing the builder's package.json}:${builder name}`.

Finally, we may run our builder via the CLI as follows:

```sh
nx run platform:echo
```

To which we'll see the console output:

```sh
> ng run platform:echo
Executing "echo"...
Hello World

Done.
```

## Debugging Builders

As part of Nx's computation cache process, Nx forks the node process, which can make it difficult to debug a builder command. Follow these steps to debug an executor:

1. Make sure VSCode's `debug.node.autoAttach` setting is set to `On`.
2. Find the executor code and set a breakpoint.
3. Use node in debug to execute your executor command, replacing `nx` with the internal `tao` script.

```bash
node --inspect-brk node_modules/.bin/tao build best-app
```
