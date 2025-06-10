---
title: Add a Svelte Project
description: Learn how to integrate Svelte with Nx, including setting up applications, configuring build systems, and leveraging Nx features with manual configuration.
---

# Add a Svelte Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/svelte" /%}

**Supported Features**

Because we are not using a Nx plugin for Svelte, there are a few items we'll have to configure manually. We'll have to configure our own build system. There are no pre-created Svelte-specific code generators. And we'll have to take care of updating any framework dependencies as needed.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}🚫 Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Setup workspace

**Create a new Nx workspace**

{% tabs %}
{%tab label="npm"%}

```shell
npx create-nx-workspace@latest acme --preset=ts-standalone --nx-cloud=yes
```

{% /tab %}
{%tab label="yarn"%}

```shell
npx create-nx-workspace@latest acme --preset=ts-standalone --nx-cloud=yes --pm yarn
```

{% /tab %}
{%tab label="pnpm"%}

```shell
npx create-nx-workspace@latest acme --preset=ts-standalone --nx-cloud=yes --pm pnpm
```

{% /tab %}
{% /tabs %}

**Add @nx/vite, svelte, and other dependencies to your workspace**

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/vite` and `@nx/js` versions that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

{% tabs %}
{%tab label="npm"%}

```shell
npm add -D vitest vite svelte svelte-check @sveltejs/vite-plugin-svelte
nx add @nx/vite @nx/js
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add -D vitest vite svelte svelte-check @sveltejs/vite-plugin-svelte
nx add @nx/vite @nx/js
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add -D vitest vite svelte svelte-check @sveltejs/vite-plugin-svelte
nx add @nx/vite @nx/js
```

{% /tab %}

{% tab label="bun" %}

```shell
bun add -D vitest vite svelte svelte-check @sveltejs/vite-plugin-svelte
nx add @nx/vite @nx/js
```

{% /tab %}
{% /tabs %}

## Create the application

Create your `index.html` at the root with the following:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Acme</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

Navigate to `src/index.ts` and change it to `src/main.ts` and add the following content:

```ts
import App from './App.svelte';

const app = new App({
  target: document.getElementById('app'),
});

export default app;
```

Create a new file `src/App.svelte` and add the following content:

```ts {% fileName="src/App.svelte" %}
<script lang="ts">
  let count: number = 0;
  const increment = () => {
    count += 1;
  };
</script>

<button on:click={increment}>
  count is {count}
</button>
```

Since we have a `.svelte` file, we'll need to tell typescript how to handle it. Create a new file `src/svelte-shims.d.ts` and add the following content:

```ts {% fileName="src/svelte-shims.d.ts" %}
declare module '*.svelte' {
  import type { ComponentType } from 'svelte';
  const component: ComponentType;
  export default component;
}
```

Alternatively, you could also extend the `tsconfig.json` file to use tsconfig/svelte.

```json {% fileName="tsconfig.json" %}
{
  "extends": "@tsconfig/svelte/tsconfig.json"
  //... other configs
}
```

See more here: [Svelte TypeScript](https://www.npmjs.com/package/@tsconfig/svelte)

## Configure Nx to build and serve the application

Navigate to `vite.config.ts` add `svelte` to your plugins.

```ts
// Add this to your imports
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    //... other plugins
    svelte(), // Add this line
  ],
  //...
  server: {
    port: 4200,
    host: 'localhost',
  },
});
```

Change your `tsconfig.lib.json` to `tsconfig.app.json`. It should look like this:

```json {% fileName="/tsconfig.app.json" %}
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

Navigate to `nx.json` it should contain the following:

```json {% fileName="/project.json" %}
{
  // ... other config
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "previewTargetName": "preview",
        "testTargetName": "test",
        "serveTargetName": "serve",
        "serveStaticTargetName": "serve-static"
      }
    }
  ]
}
```

We also need to add a `svelte.config.js` file to the project root with the following content:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
};
```

Update your `package.json` to include:

```json {% fileName="/package.json" %}
{
  "type": "module"
}
```

{% callout "Note" title="Why use the type: module?" %}
We need to add `"type": "module"` to our `package.json` file because we are using ESM only packages. See more here: [ESM Package](https://vitejs.dev/guide/troubleshooting.html#this-package-is-esm-only)
{% /callout %}

Test it out

**Build the application**

```shell
nx build acme
```

Your build artifacts should be in `dist/acme`

**Serve the application**

```shell
nx serve acme
```

Navigate to `http://localhost:4200` and you should see your application.

## Create a library

Instead of having our Counter directly defined in `App.svelte` file, let's create a library that we can import into our application.

```shell
nx generate @nx/js:library libs/counter --unitTestRunner=vitest --bundler=vite --importPath=@acme/counter
```

Create the Counter component at `libs/counter/src/lib/Counter.svelte` and copy the contents of your `src/App.svelte` file into it.

Update your `libs/counter/src/lib/index.ts` to export your Counter component.

```ts
export { default as Counter } from './Counter.svelte';
```

{% callout "Note" title="Remember the default keyword"%}
The `default` is import here as due to the aliasing we'll be doing later, we'll need to import the Counter component as `import { Counter } from '@acme/counter'`.
{% /callout %}

Update your project's `vite.config.ts` to include the following:

```ts
export default defineConfig({
  //... other config
  resolve: {
    alias: {
      '@acme/counter': fileURLToPath(
        new URL('/libs/counter/src/index.ts', import.meta.url)
      ),
    },
  },
});
```

This allows the runtime to resolve the `@acme/counter` import to the correct location.

Finally update your `src/App.svelte` to use the counter component.

```ts
<script lang="ts">
  import { Counter } from '@acme/counter';
</script>

<Counter />
```

Now we can build and serve our application again.

```shell
nx build acme
```

To generate the build artifact at `dist/acme`.

```shell
nx serve acme
```

To serve the application at `http://localhost:4200`.

## More Documentation

A larger example including libraries, test and more is available at [Nx Svelte Example](https://github.com/nrwl/nx-recipes/tree/main/svelte) on GitHub.

- [Nx Vite Plugin](/technologies/build-tools/vite/introduction)
- [Vite](https://vitejs.dev/)
- [Svelte](https://svelte.dev/)
