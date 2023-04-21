# Compose executors

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

```json {% fileName="project.json" %}
{
  "e2e": {
    "builder": "@nx/cypress:cypress",
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

## Devkit helper functions

| Property                 | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| logger                   | Wraps `console` to add some formatting                         |
| getPackageManagerCommand | Returns commands for the package manager used in the workspace |
| parseTargetString        | Parses a target string into `{project, target, configuration}` |
| readTargetOptions        | Reads and combines options for a given target                  |
| runExecutor              | Constructs options and invokes an executor                     |

See more helper functions in the [Devkit API Docs](/packages/devkit/documents/nx_devkit#functions)

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

```typescript
import { of } from 'rxjs';
import { eachValueFrom } from 'rxjs-for-await';

export default async function (opts) {
  return eachValueFrom(of({ success: true }));
}
```
