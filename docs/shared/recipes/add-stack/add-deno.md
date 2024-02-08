# Add a New Deno Project

**Supported Features**

Because we are using an Nx plugin for Deno, all the features of Nx are available.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/features/integrate-with-editors" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}✅ Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Framework Dependencies{% /pill %}

## Install the Deno Plugin

{% callout type="warning" title="Have Deno already installed?" %}
Make sure you have Deno installed on your machine. Consult the [Deno docs for more details](https://deno.com/manual/getting_started/installation)
{% /callout %}

```shell {% skipRescope=true %}
nx add @nx/deno
```

## Create an Application

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

Use the `app` generator to create a new Deno app.

```shell
nx g @nx/deno:app deno-app --directory=apps/deno-app
```

Serve the API by running

```shell
nx serve deno-app
```

This starts the application on localhost:4200 by default.

## Create a Library

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

To create a new library, run:

```shell
nx g @nx/deno:lib my-lib --directory=libs/my-lib
```

{% callout type="note" title="Deno Library Paths" %}
Deno library paths are maintained in the root `import_map.json` file. Because typescript doesn't understand how to parse this file, you may get errors in your code editor that are not problems during `build` or `serve`.
{% /callout %}

Once the library is created, update the following files.

```typescript {% fileName="libs/my-lib/src/lib/my-lib.ts" %}
export function someFunction(): string {
  return 'some function';
}
```

```typescript {% fileName="apps/deno-app/src/handler.ts" %}
import { someFunction } from '@my-org/my-lib';

// deno-lint-ignore require-await
export async function handler(_request: Request): Promise<Response> {
  const message = JSON.stringify({
    message: 'Hello deno-app ' + someFunction(),
  });
  return new Response(message, {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });
}
```

Now when you serve your app, you'll see the content from the library being displayed.

## More Documentation

- [@nx/deno](https://github.com/nrwl/nx-labs/tree/main/packages/deno)
- [Deno](https://deno.com)

{% cards cols="2" %}
{% card title="Converting an Express API To Deno"  type="video" url="https://youtu.be/Um8xXR54upQ" /%}
{% /cards %}
