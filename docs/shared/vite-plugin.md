The Nx plugin for [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/).

{% callout type="warning" title="Early release plugin" %}
This Nx plugin is in active development and may not be ready for real-world use. The planned release date for the stable plugin is December, 2022.
{% /callout %}

[Vite.js](https://vitejs.dev/) is a build tool that aims to provide a faster and leaner development experience for modern web projects.

Why should you use this plugin?

- Instant dev server start
- Lightning fast Hot-Module Reloading
- _Fast_ builds using Vite.
- Vite-powered tests with smart and instant watch mode

Read more about Vite and Vitest in the [Vite documentation](https://vitejs.dev/).

## Setting up Vite

To create a new workspace, run `npx create-nx-workspace@latest --preset=vite`.

### Add Vite to an existing workspace

To add the Vite plugin to an existing workspace, run the following:

{% tabs %}
{% tab label="npm" %}

```shell
npm install -D @nrwl/vite
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nrwl/vite
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm install -D @nrwl/vite
```

{% /tab %}
{% /tabs %}

### Initialize Vite.js

After you install the plugin, you need to initialize Vite.js. You can do this by running the `init` executor. This executor will make sure to install all the necessary dependencies.

```bash
nx g @nrwl/vite:init
```

{% callout type="note" title="Choosing a framework" %}
You will notice that the executor will ask you of the framework you are planning to use. This is just to make sure that the right dependencies are installed. You can always install manually any other dependencies you need.
{% /callout %}

## Using Vite.js in a React application

You can use the `@nrwl/vite:dev-server` and the `@nrwl/vite:build` executors to serve and build your React applications using Vite.js. To do this, you need to make a few adjustments to your application.

{% github-repository url="https://github.com/mandarini/nx-recipes/tree/feat/react-vite-recipe/react-vite" /%}

### 1. Change the executors in your `project.json`

#### The `serve` target

In your app's `project.json` file, change the executor of your `serve` target to use `@nrwl/vite:dev-server` and set it up with the following options:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nrwl/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
                "port": 4200,
            },
            "configurations": {
                ...
            }
        },
    }
}
```

{% callout type="note" title="Other options" %}
You do not have to set the `port` here, necessarily. You can also specify the port in the `vite.config.ts` file (see **Step 2** below).
The same goes for all other Vite.js options that you can find the [Vite.js documentation](https://vitejs.dev/config/). All these can be added in your `vite.config.ts` file.
{% /callout %}

#### The `build` target

In your app's `project.json` file, change the executor of your `build` target to use `@nrwl/vite:build` and set it up with the following options:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
        "executor": "@nrwl/vite:build",
        ...
        "options": {
            "outputPath": "dist/apps/my-app"
        },
        "configurations": {
                ...
            }
        },
    }
}
```

{% callout type="note" title="Other options" %}
You can specify more options in the `vite.config.ts` file (see **Step 2** below).
{% /callout %}

### 2. Configure Vite.js

Add a `vite.config.ts` file to the root of your app, and add the `'@vitejs/plugin-react'` plugin to it:

```ts
// eg. apps/my-app/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import ViteTsConfigPathsPlugin from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    ViteTsConfigPathsPlugin({
      root: '../../',
      projects: ['tsconfig.base.json'],
    }),
  ],
});
```

{% callout type="note" title="The `root` path" %}
Make sure the `root` path in the `ViteTsConfigPathsPlugin` options is correct. It should be the path to the root of your workspace.
{% /callout %}

In that config file, you can configure Vite.js as you would normally do. For more information, see the [Vite.js documentation](https://vitejs.dev/config/).

### 3. Move `index.html` and point it to your app's entrypoint

First of all, move your `index.html` file to the root of your app (eg. from `apps/my-app/src/index.html` to `apps/my-app/index.html`).

Then, add a module `script` tag pointing to the `main.tsx` file of your app:

```html
...
  <body>
    <div id="root"></div>
    <script type="module" src="src/main.tsx"></script>
  </body>
</html>
```

### 4. Add a `public` folder

You can add a `public` folder to the root of your app. You can read more about the public folder in the [Vite.js documentation](https://vitejs.dev/guide/assets.html#the-public-directory). Use that folder as you would normally do.

```treeview
myorg/
├── apps/
│   ├── my-app/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── ...
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── public/
│   │   │   └── my-page.md
│   │   ├── project.json
│   │   ├── ...
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
```

### 5. Adjust your app's tsconfig.json

Change your app's `tsconfig.json` (eg. `apps/my-app/tsconfig.json`) `compilerOptions` to the following:

```json
...
  "compilerOptions": {
    "jsx": "react-jsx",
    "allowJs": false,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "module": "ESNext",
    "moduleResolution": "Node",
    "noEmit": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ESNext",
    "types": ["vite/client"],
    "useDefineForClassFields": true
  },
...
```

You can read more about the TypeScript compiler options in the [Vite.js documentation](https://vitejs.dev/guide/features.html#typescript-compiler-options).

### 6. Use Vite.js!

Now you can finally serve and build your app using Vite.js:

#### Serve the app

```
nx serve my-app
```

or

```
nx run my-app:serve
```

Now, visit [http://localhost:4200](http://localhost:4200) to see your app running!

#### Build the app

```
nx build my-app
```

or

```
nx run my-app:build
```
