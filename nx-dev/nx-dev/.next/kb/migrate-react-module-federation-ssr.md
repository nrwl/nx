---
title: Migrate server-side rendered React Module Federation apps
description: Move the server build of React Module Federation apps off @nx/module-federation onto @module-federation/enhanced and @module-federation/node.
sidebar:
  label: Migrate React SSR Module Federation
filter: 'type:Guides'
topics:
  - 'Module Federation'
  - 'React'
---

{% llm_copy_prompt title="Migrate server-side rendered React Module Federation apps" %}
Migrate the server build of each server-side rendered React Module Federation app in this workspace off the Nx Module Federation APIs that Nx v24 removes. An app with a `server` target or a `*.server.config.*` file is server-side rendered. Migrate its browser build first with https://nx.dev/docs/kb/migrate-from-nx-module-federation, then follow every step at {pageUrl}.

Rules that override any shortcut you are tempted to take:

1. Before editing, keep the baseline browser stats from `dist/apps/<app>/browser/mf-stats.json`. Record the server-rendered HTML of each host route that renders a remote.
2. Replace `withModuleFederationForSSR` with `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` or `/rspack`, and drop `NxModuleFederationSSRDevServerPlugin`. Keep `@module-federation/node` as a dependency.
3. The server container sets `library: { type: 'commonjs-module' }`, `remoteType: 'script'` on both bundlers, `experiments: { asyncStartup: true }`, and `runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')]`. Its remote URLs keep the `name@` prefix and point at `<origin>/server/remoteEntry.js`.
4. Server builds write no stats. Reuse the browser `shared` map, with every entry `eager: true` on Rspack.
5. A host on a runtime manifest also calls `registerRemotes` in `server.ts` with the `/server` URLs. On webpack keep `@module-federation/*` inside the server bundle, or the server fails with `#RUNTIME-009`.
6. Replace the SSR dev server with watch builds plus `node --watch-path`. A static run is `node dist/apps/<app>/server/server.js`, never `@nx/web:file-server`. On Rspack, run it from `apps/<app>` (`node ../../dist/apps/<app>/server/server.js`), since the generated `server.ts` resolves `dist` from the working directory.
7. Accept the migration only when each host route's HTML holds the remote's markup and client scripts, and the page hydrates in a browser without errors. Report what you verified and what you did not.

Reference: {pageUrl}
{% /llm_copy_prompt %}

{% aside type="caution" title="Migrate the browser build first" %}
This guide covers only the server build. Finish
[migrating the browser build](/docs/kb/migrate-from-nx-module-federation) of every app, then
come back here.
{% /aside %}

A host or remote generated with `--ssr` builds the same container twice, once for the browser and
once for Node. The server build needs its own container format, runtime plugin, and serve targets.

## What replaces what

| Going away in v24                                                                                                      | Replacement                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `withModuleFederationForSSR` from `@nx/module-federation/webpack` or `/rspack`                                         | `ModuleFederationPlugin` with the `@module-federation/node` runtime |
| `@nx/react:module-federation-ssr-dev-server`, `@nx/webpack:ssr-dev-server`, and `NxModuleFederationSSRDevServerPlugin` | `nx:run-commands` running watch builds and `node --watch-path`      |

## Capture the server baseline

With `--ssr`, copy the browser stats from `dist/apps/<app>/browser/mf-stats.json`, since server
builds write none. Also save the HTML each host route returns with `curl` to compare against at
the end.

## Server container settings

The server container is CommonJS and loads remotes over HTTP through the Node runtime plugin.
Each remote's Express server serves its server build under `/server`, and the host's server-side
remote URLs point there. Keep that static mount in every remote's `server.ts`.

The server config needs:

- `library: { type: 'commonjs-module' }`. The browser guide drops `library` from the browser
  config only.
- `remoteType: 'script'`, on Rspack too.
- `experiments: { asyncStartup: true }`.
- `runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')]`.
- Remote URLs such as `remoteA@http://localhost:4751/server/remoteEntry.js`, with the `name@`
  prefix.

Browser and server builds each need their own production URLs.

## Server federation config

```js
// apps/shell/module-federation.server.config.js
const browser = require('./module-federation.config');

module.exports = {
  ...browser,
  remotes: {
    remoteA: 'remoteA@http://localhost:4751/server/remoteEntry.js',
  },
  library: { type: 'commonjs-module' },
  remoteType: 'script',
  runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')],
  experiments: { asyncStartup: true },
};
```

The spread reuses the browser `shared` map. On Rspack, set `eager: true` on every entry, as the
old server config did.

## Server bundler config

{% tabs syncKey="mf-bundler" %}
{% tabitem label="Rspack" %}

The generated `rspack.config.ts` already exports a `[browser, server]` array, with a second
`NxModuleFederationPlugin({ config, isServer: true })` and an `NxModuleFederationSSRDevServerPlugin`.
Keep the array in a new `rspack.config.js`. Both compilers get the browser guide's Step 6
settings, and the server compiler also gets `target: 'async-node'`:

```js
// apps/shell/rspack.config.js
const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
const {
  ModuleFederationPlugin,
} = require('@module-federation/enhanced/rspack');
const { join } = require('node:path');

const workspaceRoot = join(__dirname, '../..');
const shared = {
  resolve: { modules: ['node_modules', workspaceRoot] },
  optimization: {
    runtimeChunk: false,
    splitChunks: { cacheGroups: { default: false, common: false } },
  },
};

const browser = {
  name: 'browser',
  lazyCompilation: false,
  ...shared,
  output: {
    path: join(workspaceRoot, 'dist/apps/shell/browser'),
    publicPath: 'auto',
    uniqueName: 'shell',
    clean: true,
  },
  devServer: {
    port: 4757, // the Express server owns the app port
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    devMiddleware: {
      writeToDisk: (file) => !file.includes('.hot-update.'),
    },
  },
  plugins: [
    new NxAppRspackPlugin({
      // ... your existing browser options
      runtimeChunk: false,
      commonChunk: false,
    }),
    new NxReactRspackPlugin(),
    new ModuleFederationPlugin(require('./module-federation.config')),
  ],
};

const server = {
  name: 'server',
  target: 'async-node',
  ...shared,
  output: {
    path: join(workspaceRoot, 'dist/apps/shell/server'),
    filename: 'server.js',
    uniqueName: 'shell',
    clean: true,
  },
  plugins: [
    new NxAppRspackPlugin({
      outputPath: join(workspaceRoot, 'dist/apps/shell/server'),
      outputFileName: 'server.js',
      tsConfig: './tsconfig.app.json',
      main: './server.ts',
      runtimeChunk: false,
      commonChunk: false,
    }),
    new ModuleFederationPlugin(require('./module-federation.server.config')),
  ],
};

module.exports = [browser, server];
```

{% /tabitem %}
{% tabitem label="webpack" %}

The old server build is `webpack.server.config.ts` with `withModuleFederationForSSR`. Replace it
with a `webpack.server.config.js` next to the browser one:

```js
// apps/shell/webpack.server.config.js
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const {
  ModuleFederationPlugin,
} = require('@module-federation/enhanced/webpack');
const { join } = require('node:path');

module.exports = {
  target: 'async-node',
  entry: {}, // otherwise webpack's default ./src entry fails the build
  output: {
    path: join(__dirname, '../../dist/apps/shell/server'),
    uniqueName: 'shell',
    clean: true,
  },
  resolve: { modules: ['node_modules', join(__dirname, '../..')] },
  optimization: { runtimeChunk: false },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node', // turns on externalDependencies
      compiler: 'babel',
      main: './server.ts',
      tsConfig: './tsconfig.server.json',
      outputFileName: 'server.js',
      externalDependencies: 'all',
      outputHashing: 'none',
      ssr: true,
    }),
    new NxReactWebpackPlugin(),
    new ModuleFederationPlugin(require('./module-federation.server.config')),
  ],
};
```

{% /tabitem %}
{% /tabs %}

## Runtime manifest on the server

A host moved to a runtime manifest renders `loadRemote` on the server too, where `main.ts` never
runs. Register the server-side URLs in `server.ts` before `app.listen`:

```ts
// apps/shell/server.ts
import { registerRemotes } from '@module-federation/enhanced/runtime';

registerRemotes([
  { name: 'remoteA', entry: 'http://localhost:4751/server/remoteEntry.js' },
]);
```

On webpack, keep `@module-federation/*` inside the server bundle. Switch to
`externalDependencies: 'none'` and `mergeExternals: true`, and write an `externals` function that
skips that scope.

## Targets

Replace the SSR dev server with a `serve` that watches the browser and server builds and restarts
Node when the server bundle changes.

{% tabs syncKey="mf-bundler" %}
{% tabitem label="Rspack" %}

`rspack serve` builds both compilers and writes them to disk:

```jsonc
// apps/shell/project.json
{
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "continuous": true,
      "options": {
        "cwd": "apps/shell",
        "env": { "PORT": "4755" },
        "parallel": true,
        "commands": [
          "rspack serve --node-env=development",
          "until [ -f ../../dist/apps/shell/server/server.js ]; do sleep 1; done; node --watch-path=../../dist/apps/shell/server ../../dist/apps/shell/server/server.js",
        ],
      },
    },
  },
}
```

{% /tabitem %}
{% tabitem label="webpack" %}

Add a `server` target that runs `webpack.server.config.js`, with `dependsOn: ["build"]`. The
`serve` target also watches each remote's server output:

```jsonc
// apps/shell/project.json
{
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "continuous": true,
      "dependsOn": ["server"],
      "options": {
        "parallel": true,
        "commands": [
          "webpack build --watch --config apps/shell/webpack.config.js",
          "webpack build --watch --config apps/shell/webpack.server.config.js",
          "PORT=4750 node --watch-path=dist/apps/shell/server --watch-path=dist/apps/remoteA/server dist/apps/shell/server/server.js",
        ],
      },
    },
  },
}
```

{% /tabitem %}
{% /tabs %}

Start host and remotes together with `nx run-many -t serve -p shell remoteA -c development`.
`serve-static` becomes `node dist/apps/<app>/server/server.js` in place of `@nx/web:file-server`,
depending on the build that writes the server bundle. On Rspack, set `"cwd": "apps/<app>"` and run
`node ../../dist/apps/<app>/server/server.js`, since the generated `server.ts` resolves `dist` from the
working directory.

## Validate the result

Request each host route that renders a remote, for example with `curl`, and check that the
response holds the remote's markup and the client `<script>` tags. Then load it in a browser and
check that it hydrates without errors.

Keep `@module-federation/node` in `dependencies` when you remove `@nx/module-federation`.

## What the official plugins do not do

- **Dev orchestration.** The SSR dev-server executors started the remotes with the host and
  proxied the static ones. Start each app's `serve` yourself.
