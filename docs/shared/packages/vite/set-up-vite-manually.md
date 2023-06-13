---
title: Manually set up your project to use Vite.js
description: This guide explains how you can manually set up your project to use Vite.js in your Nx workspace.
---

# Manually set up your project to use Vite.js

{% callout type="note" title="Use our generator!" %}
It is recommended that you use the [`@nx/vite:configuration`](/packages/vite/generators/configuration) generator to do convert an existing project to use [Vite](https://vitejs.dev/).
{% /callout %}

You can use the `@nx/vite:dev-server`,`@nx/vite:build` and `@nx/vite:test` executors to serve, build and test your project using [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/). To do this, you need to make a few adjustments to your project. It is recommended that you use the [`@nx/vite:configuration`](/packages/vite/generators/configuration) generator to do this, but you can also do it manually.

A reason you may need to do this manually, is if our generator does not support conversion for your project, or if you want to experiment with custom options.

The list of steps below assumes that your project can be converted to use the `@nx/vite` executors. However, if it's not supported by the [`@nx/vite:configuration`](/packages/vite/generators/configuration) generator, it's likely that your project will not work as expected when converted. So, proceed with caution and always commit your code before making any changes.

## 1. Change the executors in your `project.json`

### The `serve` target

This applies to applications, not libraries.

In your app's `project.json` file, change the executor of your `serve` target to use `@nx/vite:dev-server` and set it up with the following options:

```json
//...
"my-app": {
    "targets": {
        //...
        "serve": {
            "executor": "@nx/vite:dev-server",
            "defaultConfiguration": "development",
            "options": {
                "buildTarget": "my-app:build",
            },
            "configurations": {
                ...
            }
        },
    }
}
```

{% callout type="note" title="Other options" %}
Any extra options that you may need to add to your server's configuration can be added in your project's `vite.config.ts` file. You can find all the options that are supported in the [Vite.js documentation](https://vitejs.dev/config/). You can see which of these options you can add in your `project.json` in the [`@nx/vite:dev-server`](/packages/vite/executors/dev-server#options) documentation.
{% /callout %}

### The `build` target

In your project's `project.json` file, change the executor of your `build` target to use `@nx/vite:build` and set it up with the following options:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
        "executor": "@nx/vite:build",
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

## 2. Configure Vite.js

### TypeScript paths

You need to use the [`vite-tsconfig-paths` plugin](https://www.npmjs.com/package/vite-tsconfig-paths) to make sure that your TypeScript paths are resolved correctly in your monorepo.

### React plugin

If you are using React, you need to use the [`@vitejs/plugin-react` plugin](https://www.npmjs.com/package/@vitejs/plugin-react).

### DTS plugin

If you are building a library, you need to use the [`vite-plugin-dts` plugin](https://www.npmjs.com/package/vite-plugin-dts) to generate the `.d.ts` files for your library.

#### Skip diagnostics

If you are building a library, you can set the `skipDiagnostics` option to `true` to speed up the build. This means that type diagnostic will be skipped during the build process. However, if there are some files with type errors which interrupt the build process, these files will not be emitted and `.d.ts` declaration files will not be generated.

If you choose to skip diagnostics, here is what your `'vite-plugin-dts'` plugin setup will look like:

```ts {% fileName="libs/my-lib/vite.config.ts" %}
...
import dts from 'vite-plugin-dts';
import { join } from 'path';
...
...
export default defineConfig({
  plugins: [
    ...,
    dts({
      entryRoot: 'src',
      tsConfigFilePath: join(__dirname, 'tsconfig.lib.json'),
      skipDiagnostics: true,
    }),
```

#### Do not skip diagnostics

If you are building a library, and you want to make sure that all the files are type checked, you can set the `skipDiagnostics` option to `false` to make sure that all the files are type checked. This means that type diagnostic will be run during the build process.

If you choose to enable diagnostics, here is what your `'vite-plugin-dts'` plugin setup will look like:

```ts {% fileName="libs/my-lib/vite.config.ts" %}
...
import dts from 'vite-plugin-dts';
...
...
export default defineConfig({
  plugins: [
    ...,
    dts({
      root: '../../',
      entryRoot: 'libs/my-lib/src',
      tsConfigFilePath: 'libs/my-lib/tsconfig.lib.json',
      include: ['libs/my-lib/src/**/*.ts'],
      outputDir: 'dist/libs/my-lib',
      skipDiagnostics: false,
    }),
```

You can read more about the configuration options in the [`vite-plugin-dts` plugin documentation](https://www.npmjs.com/package/vite-plugin-dts)).

### How your `vite.config.ts` looks like

#### For applications

Add a `vite.config.ts` file to the root of your project. If you are not using React, you can skip adding the `react` plugin, of course.

```ts {% fileName="apps/my-app/vite.config.ts" %}
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

#### For libraries

If you are setting up a library (rather than an application) to use vite, your `vite.config.ts` file should look like this:

```ts {% fileName="libs/my-lib/vite.config.ts" %}
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import { join } from 'path';

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      tsConfigFilePath: join(__dirname, 'tsconfig.lib.json'),
      skipDiagnostics: true,
    }),
    react(),
    viteTsConfigPaths({
      root: '../../',
    }),
  ],

  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: 'pure-libs-rlv1',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
```

{% callout type="note" title="The `root` path" %}
Make sure the `root` path in the `ViteTsConfigPathsPlugin` options is correct. It should be the path to the root of your workspace.
{% /callout %}

In that config file, you can configure Vite.js as you would normally do. For more information, see the [Vite.js documentation](https://vitejs.dev/config/).

## 3. Move `index.html` and point it to your app's entrypoint

This applies to applications, not libraries.

First of all, move your `index.html` file to the root of your app (e.g. from `apps/my-app/src/index.html` to `apps/my-app/index.html`).

Then, add a module `script` tag pointing to the `main.tsx` (or `main.ts`) file of your app:

```html {% fileName="apps/my-app/index.html" %}
...
  <body>
    <div id="root"></div>
    <script type="module" src="src/main.tsx"></script>
  </body>
</html>
```

## 4. Add a `public` folder

You can add a `public` folder to the root of your project. You can read more about the public folder in the [Vite.js documentation](https://vitejs.dev/guide/assets.html#the-public-directory).

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

## 5. Adjust your project's tsconfig.json

Change your app's `tsconfig.json` (e.g. `apps/my-app/tsconfig.json`) `compilerOptions` to the following:

### For React apps

```json {% fileName="apps/my-app/tsconfig.json" %}
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

### For Web apps

```json {% fileName="apps/my-app/tsconfig.json" %}
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

## 6. Use Vite.js

Now you can finally serve and build your app using Vite.js:

### Serve the app

```bash
nx serve my-app
```

or

```bash
nx run my-app:serve
```

Now, visit [http://localhost:4200](http://localhost:4200) to see your app running!

### Build the app

```bash
nx build my-app
```

or

```bash
nx run my-app:build
```
