---
title: Prepare Applications for Deployment via CI
description: Learn how to generate package.json and pruned lock files for your Nx applications to optimize container-based deployments in CI environments.
---

# Prepare applications for deployment via CI

A common approach to deploying applications is via docker containers. Some applications can be built into bundles that are environment agnostic, while others depend on OS-specific packages being installed. For these situations, having just bundled code is not enough, we also need to have `package.json`.

Nx supports the generation of the project's `package.json` by identifying all the project's dependencies. The generated `package.json` is created next to the built artifacts (usually at `dist/apps/name-of-the-app`).

Additionally, we should generate pruned lock file according to the generated `package.json`. This makes the installation in the container significantly faster as we only need to install a subset of the packages.

Nx offers two varieties of Webpack plugin which can be used to generate `package.json`.

## Basic Plugin Configuration

`@nx/webpack/plugin` plugin is compatible with a conventional webpack configuration setup which offers a smooth integration with the Webpack CLI.
It is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/webpack/plugin",
      "options": {
        "buildTargetName": "build",
        "serveTargetName": "serve",
        "serveStaticTargetName": "serve-static",
        "previewStaticTargetName": "preview"
      }
    }
  ]
}
```

Where `build`, `serve`, `serve-static` and `preview` in conjunction with your `webpack.config.js` are the names of the targets that are used to _build_, _serve_, and _preview_ the application respectively.

### NxAppWebpackPlugin

The [`NxAppWebpackPlugin`](/technologies/build-tools/webpack/recipes/webpack-plugins#nxappwebpackplugin) plugin takes a `main` entry file and produces a bundle in the output directory as defined in `output.path`. You can also pass the `index` option if it is a web app, which will handle outputting scripts and stylesheets in the output file.

To generate a `package.json` we would declare it in the plugin options.

```js {% fileName="apps/acme/app/webpack.config.js" %}
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/acme'),
  },
  devServer: {
    port: 4200,
  },
  plugins: [
    new NxAppWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'swc',
      main: './src/main.tsx',
      index: '.src/index.html',
      styles: ['./src/styles.css'],
      generatePackageJson: true,
    }),
  ],
};
```

## Programmatic usage

If you are using a custom setup that does not support the creation of a `package.json` or a lock file, you can still use Nx to generate them via The `createPackageJson` and `createLockFile` functions which are exported from `@nx/js`:

{% tabs %}

{% tab label="Custom script" %}

If you need to use a custom script, to build your application it should look similar to the following:

```javascript {% fileName="scripts/create-package-json.js" %}
const {
  createProjectGraphAsync,
  readCachedProjectGraph,
  detectPackageManager,
  writeJsonFile,
} = require('@nx/devkit');
const {
  createLockFile,
  createPackageJson,
  getLockFileName,
} = require('@nx/js');
const { writeFileSync } = require('fs');

async function main() {
  const outputDir = 'dist'; // You can replace this with the output directory you want to use
  // Detect the package manager you are using (npm, yarn, pnpm, bun)
  const pm = detectPackageManager();
  let projectGraph = readCachedProjectGraph();
  if (!projectGraph) {
    projectGraph = await createProjectGraphAsync();
  }
  // You can replace <NX_TASK_TARGET_PROJECT> with the name of the project if you want.
  const projectName = process.env.NX_TASK_TARGET_PROJECT;
  const packageJson = createPackageJson(projectName, projectGraph, {
    isProduction: true, // Used to strip any non-prod dependencies
    root: projectGraph.nodes[projectName].data.root,
  });

  const lockFile = createLockFile(
    packageJson,
    projectGraph,
    detectPackageManager()
  );

  const lockFileName = getLockFileName(pm);

  writeJsonFile(`${outputDir}/package.json`, packageJson);
  writeFileSync(`${outputDir}/${lockFileName}`, lockFile, {
    encoding: 'utf8',
  });

  //... Any additional steps you want to run
}

main();
```

Then to run the script, update your `package.json` to include the following:

```json {% fileName="package.json" %}
{
  "scripts": {
    "copy-package-json": "node scripts/create-package-json.js",
    "custom-build": "nx build && npm run copy-package-json"
  }
}
```

Now, you can run `npm run custom-build` to build your application and generate the `package.json` and lock file.

You can replace _npm_ with _yarn_, _pnpm_, or _bun_ if you are using those package managers.

{% /tab %}

{% tab label="Custom executor" %}

```typescript
import { Schema } from './schema';
import { createPackageJson, createLockFile, getLockFileName } from '@nx/js';
import { writeFileSync } from 'fs';
import {
  detectPackageManager,
  ExecutorContext,
  writeJsonFile,
} from '@nx/devkit';

export default async function buildExecutor(
  options: Schema,
  context: ExecutorContext
) {
  // ...your executor code
  const packageManager = detectPackageManager();

  const packageJson = createPackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
      isProduction: true, // We want to strip any non-prod dependencies
    }
  );

  // do any additional manipulations to "package.json" here

  const lockFile = createLockFile(
    packageJson,
    context.projectGraph,
    packageManager
  );
  const lockFileName = getLockFileName(packageManager);
  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
  writeFileSync(`${options.outputPath}/${lockFileName}`, lockFile, {
    encoding: 'utf-8',
  });

  // any subsequent executor code
}
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="What about Vite?" %}
Vite is a build tool that is great for development, and we want to make sure that it is also great for production. We are working on an `NxVitePlugin` plugin for Vite that will have parity with the `NxWebpackPlugin`. Stay tuned for updates.
{% /callout %}
