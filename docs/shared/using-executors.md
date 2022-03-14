# Using Executors / Builders

Executors perform actions on your code. This can include building, linting, testing, serving and many other actions.

There are two main differences between an executor and a shell script or an npm script:

1. Executors encourage a consistent methodology for performing similar actions on unrelated projects. i.e. A developer switching between teams can be confident that `nx build project2` will build `project2` with the default settings, just like `nx build project1` built `project1`.
2. Nx can leverage this consistency to perform the same executor across multiple projects. i.e. `nx affected --target=test` will run the `test` executor on every project that is affected by the current code change.

## Executor definitions

The executors that are available for each project are defined and configured in the project's `project.json` file.

```json
{
  "root": "apps/cart",
  "sourceRoot": "apps/cart/src",
  "projectType": "application",
  "generators": {},
  "targets": {
    "build": {
      "executor": "@nrwl/web:webpack",
      "options": {
        "outputPath": "dist/apps/cart",
        ...
      },
      "configurations": {
        "production": {
          "sourceMap": false,
          ...
        }
      }
    },
    "test": {
      "executor": "@nrwl/jest:jest",
      "options": {
        ...
      }
    }
  }
}
```

Each project has its executors defined in the `targets` property. In this snippet, `cart` has two executors defined - `build` and `test`.

> Note: `build` and `test` can be any strings you choose. For the sake of consistency, we make `test` run unit tests for every project and `build` produce compiled code for the projects which can be built.

Each executor definition has an `executor` property and, optionally, an `options` and a `configurations` property.

- `executor` is a string of the from `[package name]:[executor name]`. For the `build` executor, the package name is `@nrwl/web` and the executor name is `build`.
- `options` is an object that contains any configuration defaults for the executor. These options vary from executor to executor.
- `configurations` allows you to create presets of options for different scenarios. All the configurations start with the properties defined in `options` as a baseline and then overwrite those options. In the example, there is a `production` configuration that overrides the default options to set `sourceMap` to `false`.

## Running executors

The [`nx run`](/cli/run) cli command (or the shorthand versions) can be used to run executors.

```bash
nx run [project]:[command]
nx run cart:build
```

As long as your command name doesn't conflict with an existing nx cli command, you can use this short hand:

```bash
nx [command] [project]
nx build cart
```

You can also use a specific configuration preset like this:

```bash
nx [command] [project] --configuration=[configuration]
nx build cart --configuration=production
```

Or you can overwrite individual executor options like this:

```bash
nx [command] [project] --[optionNameInCamelCase]=[value]
nx build cart --outputPath=some/other/path
```

### Simplest executor

```json
{
  "cli": "nx",
  "id": "CustomExecutor",
  "type": "object",
  "properties": {},
  "additionalProperties": true
}
```

```typescript
export default async function (opts) {
  console.log('options', opts);
}
```

### Defining an executor schema

An executor's schema describes the inputs--what you can pass into it. The schema is used to validate inputs, to parse args (e.g., covert strings into numbers), to set defaults, and to power the VSCode plugin. It is written with [JSON Schema](https://json-schema.org/).

```json
{
  "cli": "nx",
  "id": "Echo",
  "description": "echo given string",
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "description": "Message to echo"
    },
    "upperCase": {
      "type": "boolean",
      "description": "Covert to all upper case",
      "default": false
    }
  },
  "required": ["message"]
}
```

The schema above defines two fields: `message` and `upperCase`. The `message` field is a string, `upperCase` is a boolean. The schema support for executors and generators is identical. See the section on generators above for more information.

### Implementing an executor

The implementation function takes two arguments (the options and the executor context) and returns a promise (or an async iterable) with the success property. The context params contains information about the workspace and the invoked target.

Most of the time executors return a promise.

```typescript
interface Schema {
  message: string;
  upperCase: boolean;
}

export default async function printAllCaps(
  options: Schema,
  context: ExecutorContext
): Promise<{ success: true }> {
  if (options.upperCase) {
    console.log(options.message.toUpperCase());
  } else {
    console.log(options.message);
  }
  return { success: true };
}
```

But you can also return an async iterable that can yield several values.

```typescript
async function wait() {
  return new Promise((res) => {
    setTimeout(() => res(), 1000);
  });
}

export default async function* counter(opts: { to: number; result: boolean }) {
  for (let i = 0; i < opts.to; ++i) {
    console.log(i);
    yield { success: false };
    await wait();
  }
  yield { success: opts.result };
}
```

### Composing executors

An executor is just a function, so you can import and invoke it directly, as follows:

```typescript
import printAllCaps from 'print-all-caps';

export default async function (
  options: Schema,
  context: ExecutorContext
): Promise<{ success: true }> {
  // do something before
  await printAllCaps({ message: 'All caps' });
  // do something after
}
```

This only works when you know what executor you want to invoke. Sometimes, however, you need to invoke a target. For instance, the e2e target is often configured like this:

```json
{
  "e2e": {
    "builder": "@nrwl/cypress:cypress",
    "options": {
      "cypressConfig": "apps/myapp-e2e/cypress.json",
      "tsConfig": "apps/myapp-e2e/tsconfig.e2e.json",
      "devServerTarget": "myapp:serve"
    }
  }
}
```

In this case we need to invoke the target configured in devSeverTarget. We can do it as follows:

```typescript
async function* startDevServer(
  opts: CypressExecutorOptions,
  context: ExecutorContext
) {
  const { project, target, configuration } = parseTargetString(
    opts.devServerTarget
  );
  for await (const output of await runExecutor<{
    success: boolean;
    baseUrl?: string;
  }>(
    { project, target, configuration },
    {
      watch: opts.watch,
    },
    context
  )) {
    if (!output.success && !opts.watch)
      throw new Error('Could not compile application files');
    yield opts.baseUrl || (output.baseUrl as string);
  }
}
```

The `runExecutor` utility will find the target in the configuration, find the executor, construct the options (as if you invoked it in the terminal) and invoke the executor. Note that `runExecutor` always returns an iterable instead of a promise.

### Devkit helper functions

- `logger` -- Wraps `console` to add some formatting.
- `getPackageManagerCommand` -- Returns commands for the package manager used in the workspace.
- `parseTargetString` -- Parses a target string into {project, target, configuration}.
- `readTargetOptions` -- Reads and combines options for a given target.
- `runExecutor` -- Constructs options and invokes an executor.

See more helper functions in the [Devkit API Docs](/nx-devkit/index#functions)

## Using RxJS observables

The Nx devkit only uses language primitives (promises and async iterables). It doesn't use RxJS observables, but you can use them and convert them to a `Promise` or an async iterable.

You can convert `Observables` to a `Promise` with `toPromise`.

```typescript
import { of } from 'rxjs';

export default async function (opts) {
  return of({ success: true }).toPromise();
}
```

You can use the [`rxjs-for-await`](https://www.npmjs.com/package/rxjs-for-await) library to convert an `Observable` into an async iterable.

```ts
import { of } from 'rxjs';
import { eachValueFrom } from 'rxjs-for-await';

export default async function (opts) {
  return eachValueFrom(of({ success: true }));
}
```

## See Also

- [`nx affected`](/cli/affected)
- [`nx run-many`](/cli/run-many)
