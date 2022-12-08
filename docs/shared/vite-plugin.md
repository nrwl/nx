The Nx plugin for [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/).

[Vite.js](https://vitejs.dev/) is a build tool that aims to provide a faster and leaner development experience for modern web projects.

Why should you use this plugin?

- Instant dev server start
- Lightning fast Hot-Module Reloading
- _Fast_ builds using Vite.
- Vite-powered tests with smart and instant watch mode

Read more about Vite and Vitest in the [Vite documentation](https://vitejs.dev/).

## Setting up Vite

You can create a new workspace that uses Vite with one of the following commands:

- Generate a new monorepo with a Web Components app set up with Vite

```shell
npx create-nx-workspace@latest --preset=web-components
```

- Generate a new standalone React app set up with Vite

```shell
npx create-nx-workspace@latest --preset=react-standalone
```

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

## Generate an application using Vite

You can generate a React or a Web application that uses Vite.js. The `@nrwl/react:app` and `@nrwl/web:app` generators accept the `bundler` option, where you can pass `vite`. This will generate a new application configured to use Vite.js, and it will also install all the necessary dependencies.

To generate a React application using Vite.js, run the following:

```bash
nx g @nrwl/react:app my-app --bundler=vite
```

To generate a Web application using Vite.js, run the following:

```bash
nx g @nrwl/web:app my-app --bundler=vite
```

## Modify an existing React or Web application to use Vite.js

You can use the `@nrwl/vite:configuration` generator to change your React or Web application to use Vite.js. This generator will modify your application's configuration to use Vite.js, and it will also install all the necessary dependencies.

You can read more about this generator on the [`@nrwl/vite:configuration`](/packages/vite/generators/configuration) generator page.

## Set up your apps to use Vite.js manually

You can use the `@nrwl/vite:dev-server` and the `@nrwl/vite:build` executors to serve and build your applications using Vite.js. To do this, you need to make a few adjustments to your application.

{% github-repository url="https://github.com/mandarini/nx-recipes/tree/feat/react-vite-recipe/vite-example" /%}

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

#### TypeScript paths

You need to use the [`vite-tsconfig-paths` plugin](https://www.npmjs.com/package/vite-tsconfig-paths) to make sure that your TypeScript paths are resolved correctly in your monorepo.

#### React plugin

If you are using React, you need to use the [`@vitejs/plugin-react` plugin](https://www.npmjs.com/package/@vitejs/plugin-react).

#### How your `vite.config.ts` looks like

Add a `vite.config.ts` file to the root of your app. If you are not using React, you can skip adding the `react` plugin, of course.

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
    }),
  ],
});
```

{% callout type="note" title="The `root` path" %}
Make sure the `root` path in the `ViteTsConfigPathsPlugin` options is correct. It should be the path to the root of your workspace.
{% /callout %}

In that config file, you can configure Vite.js as you would normally do. For more information, see the [Vite.js documentation](https://vitejs.dev/config/).

#### Creating a root `vite.config.ts` file

You can create a `vite.config.ts` file to the root of your workspace, as well as at the root of each of your applications. This file is used to configure Vite. You can read more about the configuration options in the [Vite documentation](https://vitejs.dev/config/).

The root `vite.config.ts` file can be used for all applications, and you can place in there general configurations that would apply for all your apps using Vite in your workspace. The application-specific `vite.config.ts` files can be used to override the root configuration, or, for example, import framework-specific plugins (eg. the `'@vitejs/plugin-react'` for React apps). The application-specific configuration files extend (using [`mergeConfig`](https://vitejs.dev/guide/api-javascript.html#mergeconfig)) the root configuration file. You can adjust this behavior to your needs.

So, if you are using a root `vite.config.ts` file, you should adjust your code as follows:

```ts
// <workspace-root>vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
});
```

and then in your app's `vite.config.ts` file:

```ts
// eg. apps/my-app/vite.config.ts
import { mergeConfig } from 'vite';
import baseConfig from '../../vite.config';
import react from '@vitejs/plugin-react';
import ViteTsConfigPathsPlugin from 'vite-tsconfig-paths';

export default mergeConfig(baseConfig, {
  plugins: [
    react(),
    ViteTsConfigPathsPlugin({
      root: '../../',
    }),
  ],
});
```

### 3. Move `index.html` and point it to your app's entrypoint

First of all, move your `index.html` file to the root of your app (eg. from `apps/my-app/src/index.html` to `apps/my-app/index.html`).

Then, add a module `script` tag pointing to the `main.tsx` (or `main.ts`) file of your app:

```html
...
  <body>
    <div id="root"></div>
    <script type="module" src="src/main.tsx"></script>
  </body>
</html>
```

### 4. Add a `public` folder

You can add a `public` folder to the root of your app. You can read more about the public folder in the [Vite.js documentation](https://vitejs.dev/guide/assets.html#the-public-directory).

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
| . | . |   ├── favicon.ico
│   │   │   └── my-page.md
│   │   ├── project.json
│   │   ├── ...
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
```

You can use the `public` folder to store static **assets**, such as images, fonts, and so on. You can also use it to store Markdown files, which you can then import in your app and use as a source of content.

### 5. Adjust your app's tsconfig.json

Change your app's `tsconfig.json` (eg. `apps/my-app/tsconfig.json`) `compilerOptions` to the following:

#### For React apps

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

#### For Web apps

```json
...
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ESNext", "DOM"],
    "moduleResolution": "Node",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"],
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
