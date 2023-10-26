# Add a Vue Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/vue" /%}

{% callout title="Official Vue Plugin" %}
This recipe does not use the official Vue plugin, so it doesn't use generators or automate updating framework dependencies. Use [`@nx/vue`](/nx-api/vue) to use those features.
{% /callout %}

**Supported Features**

We'll be using an Nx plugin called [@nx/vite](/nx-api/vite). Although we are using `@nx/vite`, not all dependencies will be able to be automatically updated. So we'll have to update any framework dependencies as needed.

{% pill url="/core-features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/core-features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/core-features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/core-features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/core-features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/core-features/integrate-with-editors" %}✅ Integrate with Editors{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/core-features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/core-features/plugin-features/use-task-executors" %}✅ Use Task Executors{% /pill %}
{% pill url="/core-features/plugin-features/use-code-generators" %}🚫 Use Code Generators{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Setup workspace

**Create a new Nx workspace**

```shell
create-nx-workspace@latest acme --preset=ts-standalone --nx-cloud=true
```

**Add @nx/vite, vue, and other dependencies to your workspace**

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/vite` and `@nx/js` versions that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

{% tabs %}
{%tab label="npm"%}

```shell
npm install --save-dev @nx/vite @nx/js vue vue-tsc vitest vite-tsconfig-paths vite-plugin-dts vite @vitejs/plugin-vue @vitejs/plugin-vue-jsx
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/vite @nx/js vue vue-tsc vitest vite-tsconfig-paths vite-plugin-dts vite @vitejs/plugin-vue @vitejs/plugin-vue-jsx
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add --dev @nx/vite @nx/js vue vue-tsc vitest vite-tsconfig-paths vite-plugin-dts vite @vitejs/plugin-vue @vitejs/plugin-vue-jsx
```

{% /tab %}
{% /tabs %}

## Create the application

```shell
touch index.html
```

And add the following content:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Acme</title>

    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="./favicon.ico" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

Navigate to `src/index.ts` and change it to `src/main.ts` and add the following content:

```ts
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

Create a new file `src/App.vue` with the following content:

```ts
<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);

function increment() {
  count.value++;
}
</script>
<template>
  <div>count is {{ count }}</div>
  <button @click="increment">Increment</button>
</template>
```

## Configure Nx to use build and serve your Vue application

Navigate to `vite.config.ts` and add the following content:

```ts
// Add this to your imports
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';

export default defineConfig({
  plugins: [
    //.... other plugins
    vue(),
    vueJsx(),
  ],
});
```

Create a new file `env.d.ts` for example at the root of the project and add the following content:

```ts
/// <reference types="vite/client" />
/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<object, object, any>;
  export default component;
}
```

We need this file to ensure that Vue types are available to the compiler.

Update your `tsconfig.lib.json` to be `tsconfig.app.json` an add the following content:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/out-tsc",
    "types": ["node", "vite/client"],
    "jsxImportSource": "vue"
  },
  "files": [],
  "exclude": [
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.tsx",
    "src/**/*.test.tsx",
    "src/**/*.spec.js",
    "src/**/*.test.js",
    "src/**/*.spec.jsx",
    "src/**/*.test.jsx"
  ],
  "include": [
    "src/**/*.ts",
    "src/**/*.d.ts",
    "src/**/*.tsx",
    "**/*.vue",
    "vite.config.ts",
    "env.d.ts"
  ]
}
```

We include `vite.config.ts` and `env.d.ts` to ensure that the types are available to the compiler.

Navigate to `project.json` and update it with the following content:

```json
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/acme"
      },
      "configurations": {
        "development": {
          "mode": "development"
        },
        "production": {
          "mode": "production"
        }
      }
    },
    "serve": {
      "executor": "@nx/vite:dev-server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "acme:build"
      },
      "configurations": {
        "development": {
          "buildTarget": "acme:build:development",
          "hmr": true
        },
        "production": {
          "buildTarget": "acme:build:production",
          "hmr": false
        }
      }
    },
```

This allows us to use `nx build` and `nx serve` to build and serve our Vue application.

Test it out

**Build**

```shell
nx build acme
```

**Serve**

```shell
nx serve acme
```

## Create a library

Instead of having our Counter directly defined in the app we can instead create a library that exports the Counter component.

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

Create a new library `nx generate @nx/js:library --name=Counter --directory=libs/counter --unitTestRunner=vitest --bundler=vite --importPath=@acme/counter`

Create your Counter component at `counter/src/lib/Counter.vue` and copy the contents of your `src/App.vue` into it.

Update your `libs/counter/src/lib/index.ts` to export your Counter component.

```ts
export { default as Counter } from './Counter.vue';
```

{% callout type="Note" %}
The `default` is very import here as it allows us to import the component using `import { Counter } from '@acme/counter'` instead of `import Counter from '@acme/counter'`.
{% /callout %}

Update your root `./vite.config.ts` to include the following:

```ts
export default defineConfig({
  //... other config
  resolve: {
    alias: {
      '@acme/counter': fileURLToPath(
        new URL('./counter/src/index.ts', import.meta.url)
      ),
    },
  },
});
```

This allows the runtime to resolve the `@acme/counter` import to the correct location.

Finally update your `src/App.vue` to use the Counter component.

```ts
<script setup lang="ts">
import { Counter } from '@acme/counter';
</script>
<template>
    <Counter />
</template>
```

Test it out

**Build**

```shell
nx build acme
```

**Serve**

```shell
nx serve acme
```

## More Documentation

A larger example including libraries, tests, and more is available at [Nx Vue Example](https://github.com/nrwl/nx-recipes/tree/main/vue) on GitHub.

- [Nx Vite Plugin](/nx-api/vite)
- [Vite](https://vitejs.dev/)
- [Vue](https://v3.vuejs.org/)
