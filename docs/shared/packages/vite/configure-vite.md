---
title: Configure Vite on your Nx workspace
description: This guide explains how you can configure Vite in your Nx workspace.
---

# Configure Vite on your Nx workspace

{% callout type="note" title="Use our generator!" %}
It is recommended that you use the [`@nx/vite:configuration`](/technologies/build-tools/vite/api/generators/configuration) generator to set up [Vite](https://vitejs.dev/) for your new or existing projects.
{% /callout %}

The `@nx/vite` plugin generators take care of configuring Vite for you. However, you may need to set up Vite manually in some cases. This guide explains how you can configure Vite in your Nx workspace.

## TypeScript paths

You need to use the `nxViteTsPaths()` plugin to make sure that your TypeScript paths are resolved correctly in your monorepo.

## Framework plugins

If you are using React, you need to use the [`@vitejs/plugin-react` plugin](https://www.npmjs.com/package/@vitejs/plugin-react). If you're using Vue, you need to use the [`@vitejs/plugin-vue` plugin](https://www.npmjs.com/package/@vitejs/plugin-vue).

## Set the `root` path

Make sure to set the `root: __dirname,` property on your config object. This is necessary to make sure that the paths are resolved correctly in your monorepo.

## Set the build `outDir` path

Make sure you set the `outDir` property on your `build` object. Set the path as relative to the workspace root, so for example if your project is located in `apps/my-app`, set the `outDir` to `../../dist/apps/my-app`. If your project is located in `my-app`, set the `outDir` to `../dist/my-app`, etc.

## DTS plugin

If you are building a library, you need to use the [`vite-plugin-dts` plugin](https://www.npmjs.com/package/vite-plugin-dts) to generate the `.d.ts` files for your library.

### Skip diagnostics

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

### Do not skip diagnostics

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

You can read more about the configuration options in the [`vite-plugin-dts` plugin documentation](https://www.npmjs.com/package/vite-plugin-dts).

## Copying assets

If you have assets outside of [`publicDir`](https://vitejs.dev/config/shared-options.html#publicdir) that need to be copied the output folder, then you can use `nxCopyAssetsPlugin` from `@nx/vite`.

```ts {% fileName="vite.config.ts" highlightLines=[4, 12]}
/// <reference types='vitest' />
import { defineConfig } from 'vite';
// ...
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/testlib',

  plugins: [
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  // ...
});
```

## For testing

If you're using `vitest`, make sure your `test` object in your `vite.config.ts` file looks like this:

```ts
...
  test: {
    globals: true,
    cache: {
      dir: '../node_modules/.vitest/<project-root>',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../coverage/<project-root>',
      provider: 'v8',
    },
  },
...
```

Note how we're specifying `reporters` and `environment`.

## How your `vite.config.ts` looks like

### For applications

Add a `vite.config.ts` file to the root of your project. If you are not using React, you can skip adding the `react` plugin, of course.

```ts {% fileName="apps/my-app/vite.config.ts" %}
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: '../../dist/apps/my-app',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  cacheDir: '../../node_modules/.vite/apps/my-app',
  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react(), nxViteTsPaths()],

  test: {
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/my-app',
      provider: 'v8',
    },
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest/apps/my-app',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});
```

### For libraries

If you are setting up a library (rather than an application) to use Vite, your `vite.config.ts` file should look like this:

```ts {% fileName="libs/my-lib/vite.config.ts" %}
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../node_modules/.vite/my-lib',
  plugins: [
    react(),
    nxViteTsPaths(),
    dts({
      entryRoot: 'src',
      tsConfigFilePath: path.join(__dirname, 'tsconfig.lib.json'),
      skipDiagnostics: true,
    }),
  ],
  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    outDir: '../dist/libs/my-lib',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: 'my-lib',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es'],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
  test: {
    globals: true,
    cache: {
      dir: '../node_modules/.vitest/libs/my-lib',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../coverage/libs/my-lib',
      provider: 'v8',
    },
  },
});
```

In that config file, you can configure Vite as you would normally do. For more information, see the [Vite.js documentation](https://vitejs.dev/config/).

## Set up file replacements

You can use the `replaceFiles()` plugin (`@nx/vite/plugins/rollup-replace-files.plugin`) to replace files in your build. You can import the plugin from `@nx/vite/plugins/rollup-replace-files.plugin`. And you can set it up like this:

```ts {% fileName="apps/my-app/vite.config.ts" %}
...
import { replaceFiles } from '@nx/vite/plugins/rollup-replace-files.plugin';

export default defineConfig({
  ...

  plugins: [
    ...
    replaceFiles([
      {
        replace: 'apps/my-app/src/environments/environment.ts',
        with: 'apps/my-app/src/environments/environment.prod.ts',
      },
    ]),
  ],

  ...
});
```
