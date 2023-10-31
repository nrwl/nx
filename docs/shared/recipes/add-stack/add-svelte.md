# Add a Svelte Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/svelte" /%}

**Supported Features**

Because we are not using a Nx plugin for Svelte, there are a few items we'll have to configure manually. We'll have to configure our own build system. There are no pre-created Svelte-specific code generators. And we'll have to take care of updating any framework dependencies as needed.

{% pill url="/core-features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/core-features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/core-features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/core-features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/core-features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/core-features/integrate-with-editors" %}✅ Integrate with Editors{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/core-features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/core-features/plugin-features/use-task-executors" %}🚫 Use Task Executors{% /pill %}
{% pill url="/core-features/plugin-features/use-code-generators" %}🚫 Use Code Generators{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Setup workspace

**Create a new Nx workspace**

{% tabs %}
{%tab label="npm"%}

```shell
npx create-nx-workspace@latest workspace --preset=react-monorepo --style=css --bundler=vite --nx-cloud=true --appName=acme
```

{% /tab %}
{%tab label="yarn"%}

```shell
npx create-nx-workspace@latest workspace --preset=react-monorepo --style=css --bundler=vite --nx-cloud=true --appName=acme --pm yarn
```

{% /tab %}
{%tab label="pnpm"%}

```shell
npx create-nx-workspace@latest workspace --preset=react-monorepo --style=css --bundler=vite --nx-cloud=true --appName=acme --pm pnpm
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
npm install --save-dev @nx/vite @nx/js vitest vite svelte svelte-check @sveltejs/vite-plugin-svelte
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/vite @nx/js vitest vite svelte svelte-check @sveltejs/vite-plugin-svelte
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add --save-dev @nx/vite @nx/js vitest vite svelte svelte-check @sveltejs/vite-plugin-svelte
```

{% /tab %}
{% /tabs %}

## Create the application

Before we start to create our application, let's remove the React application that was created for us.

```shell
rm -rf apps/acme/src/app/*
```

Update your `apps/acme/src/index.html` to the following:

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

Navigate to `apps/acme/src/main.tsx` and change it to `apps/acme/src/main.ts` and add the following content:

```ts
import App from './app/App.svelte';

const app = new App({
  target: document.getElementById('app'),
});

export default app;
```

Create a new file `apps/acme/src/app/App.svelte` and add the following content:

```ts
<script lang="ts">
    let count: number = 0
    const increment = () => {
      count += 1
    }
  </script>

  <button on:click={increment}>
    count is {count}
  </button>

```

## Configure Nx to build and serve the application

Navigate to `vite.config.ts` update the file name to `vite.config.mts` and add the following content:

```ts
// Add this to your imports
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    //...
    svelte(),
  ],

  server: {
    port: 4200,
    host: 'localhost',
  },
});
```

{%callout type="Note" title="Why use the .mts file extension?" %}
We change `vite.config.ts` to `vite.config.mts` because `'@sveltejs/vite-plugin-svelte'` is an ESM only package. As a result, we need to use the `.mts` extension to tell Nx to use the ESM loader. See more here: [ESM Package](https://vitejs.dev/guide/troubleshooting.html#this-package-is-esm-only)
{% /callout %}

Update your `tsconfig.app.json` with the following content:

```json {% fileName="/apps/acme/tsconfig.app.json" %}
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "node",
    "target": "esnext",
    "ignoreDeprecations": "5.0",
    "isolatedModules": true,
    "sourceMap": true,
    "types": ["svelte", "node", "vite/client"],
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "checkJs": true
  },
  "include": [
    "src/**/*.d.ts",
    "src/**/*.ts",
    "src/**/*.js",
    "src/**/*.svelte",
    "vite.config.mts"
  ],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

Navigate to `project.json` and update it with the following content:

```json {% fileName="/apps/acme/project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/apps/acme"
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
    }
  }
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

Your build artifacts should be in `dist/apps/acme`

**Serve the application**

```shell
nx serve acme
```

Navigate to `http://localhost:4200` and you should see your application.

## Create a library

Instead of having our Counter directly defined in `App.svelte` file, let's create a library that we can import into our application.

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```shell
nx generate @nx/js:library --name=Counter --directory=libs/counter --unitTestRunner=vitest --bundler=vite --importPath=@acme/counter
```

Create the Counter component at `libs/counter/src/lib/Counter.svelte` and copy the contents of your `apps/acme/src/App.svelte` file into it.

Update your `libs/counter/src/lib/index.ts` to export your Counter component.

```ts
export { default as Counter } from './Counter.svelte';
```

{% callout "Note" title="Remember the default keyword"%}
The `default` is import here as due to the aliasing we'll be doing later, we'll need to import the Counter component as `import { Counter } from '@acme/counter'`.
{% /callout %}

Update your project's `/apps/acme/vite.config.mts` to include the following:

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

Finally update your `apps/acme/src/App.svelte` to use the counter component.

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

To generate the build artifact at `dist/apps/acme`.

```shell
nx serve acme
```

To serve the application at `http://localhost:4200`.

## More Documentation

A larger example including libraries, test and more is available at [Nx Svelte Example](https://github.com/nrwl/nx-recipes/tree/main/svelte) on GitHub.

- [Nx Vite Plugin](/nx-api/vite)
- [Vite](https://vitejs.dev/)
- [Svelte](https://svelte.dev/)
