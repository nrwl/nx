# Creating Builders in Your Nx Workspace

Creating builders for your workspace is a way to standardize scripts that you may run during your development/building/deploying tasks to enable Nx's `affected` command and caching capabilities.

This guide will show you how to create, run, and customize builders within your Nx workspace. In the examples, we'll use the trivial use-case of an `echo` command.

## Creating a Builder

Your builder should be created within the `tools` directory of your Nx workspace like so:

```treeview
happynrwl/
├── apps/
├── libs/
├── tools/
│   └── builders/
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

This file will describe the options being sent to the builder (very similar to the `schema.json` file of schematics).

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

```ts
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

```ts
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

(e.g. our [cypress builder](https://github.com/nrwl/nx/blob/master/packages/cypress/src/builders/cypress/cypress.impl.ts)

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

Note that this `builder.json` file is naming our builder 'echo' for the CLI's purposes, and maping that name to the given implemetation file and schema.

### package.json

This is all that’s required from the `package.json` file:

```json
{
  "builders": "./builder.json"
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
          "builder": "./tools/builders/echo:echo",
          "options": {
            "textToEcho": "Hello World"
          }
        }
      }
    }
  }
}
```

Note that the format of the `builder` string here is: `${Path to directory containing the builder's package.json}:${builder name}`.

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
