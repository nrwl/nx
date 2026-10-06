# Migrate Angular apps off Nx Module Federation

Nx v24 removed Nx Module Federation. `@nx/module-federation` now only ships stubs that keep
old configs loadable while Nx builds the project graph. They do not configure Module Federation,
and the Nx MF executors, generators, and runtime helpers are gone. Migrate every project listed in
the migration's agent context to the official Module Federation plugins, keeping each app's bundler.

## Before you edit

- The workspace is already on Nx v24, so the old setup no longer builds here. To capture the
  baseline the steps below ask for, check out the commit before this upgrade in a separate git
  worktree, install with its lockfile, and build there. Do not downgrade this workspace. If you
  cannot build a baseline, say so in your report instead of calling the comparison a pass.
- Work only on the projects the agent context lists, plus any file they import from.
- Remove `@nx/module-federation` from `package.json` only after no file in the workspace imports
  it and every migrated app builds. Another prompt in this run may still be migrating the other
  framework's apps.

## Rules

Migrate this Angular workspace off the Nx Module Federation APIs that Nx v24 removes. Follow every step at https://nx.dev/docs/kb/migrate-angular-module-federation in order. Default to Path A (keep the current bundler, use the official plugin). Take Path B (Native Federation) only when the user asks for it.

Rules 2 to 7 cover Path A. On Path B, follow that section of the page instead:

1. Before editing, run production builds and keep every `mf-stats.json` (`dist/apps/<app>/mf-stats.json` on webpack, `dist/apps/<app>/browser/mf-stats.json` on Rspack). Reproduce its `shared` array, `exposes`, and container name. If a generated Rspack app fails its initial `maximumError` budget, raise it. If webpack 5.111 or later fails with `Path variable [contenthash:20] not implemented`, pin webpack to 5.110 or earlier.
2. Replace `withModuleFederation` and `NxModuleFederationPlugin` from `@nx/module-federation/angular` with `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` or `/rspack`, and drop `NxModuleFederationDevServerPlugin`. Keep `@nx/angular:webpack-browser` with `customWebpackConfig` on webpack, and `createConfig` from `@nx/angular-rspack` on Rspack.
3. Browser containers are ES modules: set `library: { type: 'module' }`, `experiments.outputModule: true` on webpack or `output.module: true` on Rspack, `filename: 'remoteEntry.mjs'` on webpack and `remoteEntry.js` on Rspack, `dts: false`, `output.publicPath: 'auto'`, `output.uniqueName`, and `optimization.runtimeChunk: false`. An Rspack host keeps its runtime chunk under the dev server. Write `remotes` as plain URLs with no `name@` prefix, one entry per remote even when the host stats list it once per exposed module.
4. On webpack, add `resolve.alias` entries for every workspace library referenced through `tsconfig` paths. Never alias a `<remote>/<exposed>` entry such as `remoteA/Routes`, `remoteNg/Module`, or a `federate-module` path. Rspack's `createConfig` reads the paths itself and needs no alias.
5. A host that already calls `registerRemotes` from `@module-federation/enhanced/runtime` is done, including `mf-manifest.json` entries with no `type`. For hosts on `@nx/angular/mf`, convert `setRemoteDefinitions` to `registerRemotes` with `type: 'module'` and `loadRemoteModule(name, './Routes')` to `loadRemote('<container-name>/Routes')`. Map keys and `loadRemote` prefixes are the normalized container name. Map values must be full `remoteEntry.mjs` URLs (`remoteEntry.js` on Rspack).
6. On webpack, replace the `serve` target with `@nx/angular:dev-server`. On Rspack keep the inferred targets. Keep each remote's `dependsOn: ['<host>:serve']`, set `headers: { 'Access-Control-Allow-Origin': '*' }` on every remote's serve target (on Rspack under `devServer.headers` in `rspack.config.ts`), and add a `serve-static` target per app using `@nx/web:file-server` with `staticFilePath`, `dependsOn: ['build']`, `spa: true`, `watch: false`, never `buildTarget`. Point Playwright `webServer.command`, or Cypress `webServerCommands` and `ciWebServerCommand`, at `nx run-many -t serve-static -p <host> <remotes>`.
7. Remove `@nx/module-federation` only after the new setup builds and runs. Move `@module-federation/enhanced` to `dependencies` (`pnpm add -P` on pnpm). Rebuild uncached, production last. On Rspack a development build needs `NGRS_CONFIG=development`, or it exits 0 with production output. After removing the package, rename any copy left in `node_modules` (pnpm keeps one under `.pnpm/` for optional peers) for one uncached build, then put it back.
8. Do not claim hot-update parity or shared-state parity from a green build. Remote edits reach the host after a reload, before and after this migration. On Rspack the first load after the dev server starts can need one reload. `Cannot find module '<id>'` while loading `./Routes` means a stale cache: run `nx reset`, delete `.angular/cache`, and rebuild. Report what you verified and what you did not.
9. On Path B, install the `@angular-architects/native-federation` release matching the workspace's Angular major and minor. A host calling `loadRemote('remoteA/Routes')` switches to `loadRemoteModule('remoteA', './Routes')`.
10. For apps with a server build (a `server` target or a `webpack.server.config.*` file), also follow https://nx.dev/docs/kb/migrate-module-federation-ssr before Step 3. Path B does not cover server-side rendering. Stop and report if the user asks for Path B on one.

Nx v23 deprecates the Angular Module Federation generators, executors, runtime helpers, and the
`withModuleFederation` and `NxModuleFederationPlugin` wrappers in `@nx/module-federation/angular`.
Nx v24 will remove them. Module Federation itself stays. The Nx APIs wrapped the official
[Module Federation](https://module-federation.io) plugin, which supports both webpack and Rspack.

Migrate before you upgrade to v24. The old packages still build, which gives you a baseline to
compare against. Nx will also ship migrations for this later.

You have one decision to make before you start:

- **Path A** keeps your bundler and swaps the wrapper for the official plugin. Your build target,
  routes, and deployment model stay the same. It is the conservative option and the smallest diff.
- **Path B** moves to [Native Federation](https://www.npmjs.com/package/@angular-architects/native-federation)
  and onto the esbuild-based `@angular/build:application` builder. It is the larger change, and
  the one more likely to track Angular's own direction.

> **Scope:** Static and runtime-loaded remotes. For server-side rendered (`--ssr`) apps, follow Path A and
> [migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-module-federation-ssr), which changes the
> server build before Step 3. Path B does not cover them. For React, see the
> [React guide](https://nx.dev/docs/kb/migrate-from-nx-module-federation).

## What replaces what

| Going away in v24                                                   | Replacement                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `withModuleFederation` from `@nx/module-federation/angular`         | `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` |
| `NxModuleFederationPlugin` from `@nx/module-federation/angular`     | `ModuleFederationPlugin` from `@module-federation/enhanced/rspack`  |
| `setRemoteDefinitions`, `setRemoteDefinition` from `@nx/angular/mf` | `registerRemotes` from `@module-federation/enhanced/runtime`        |
| `loadRemoteModule` from `@nx/angular/mf`                            | `loadRemote` from `@module-federation/enhanced/runtime`             |
| `@nx/angular:module-federation-dev-server`                          | `@nx/angular:dev-server`, plus the targets you start yourself       |
| `NxModuleFederationDevServerPlugin`                                 | Not supported                                                       |
| `@nx/angular:module-federation-static-server`                       | Not supported                                                       |

The last two ran processes and built nothing. `NxModuleFederationDevServerPlugin` was the Rspack
form of the dev-server executor, which started the host and every remote from one `nx serve`.
`module-federation-static-server` served the remotes you weren't working on from one port. Step 6
replaces both with targets you start yourself.

## Capture a baseline first

A remote can render correctly while it and the host hold separate copies of a shared library.
Record what works now:

- Serve one host at a time with its remotes and visit the routes that load each remote.
- Edit a file in the host and in a remote, and note how each change reaches the page.
- Before you rebuild, copy each app's `mf-stats.json` to a folder such as `baseline/`. It's at
  `dist/apps/<app>/mf-stats.json` on webpack and `dist/apps/<app>/browser/mf-stats.json` on
  Rspack. Both paths reproduce its `shared` map, `exposes`, and container name.
- Note each app's `serve` port. Step 3 uses them in the remote URLs.

## Step 1: inventory the workspace

```shell
grep -rE "@nx/module-federation|@nx/angular/mf|module-federation-dev-server|module-federation-static-server|module-federation-dev-ssr|withModuleFederationForSSR" --include="*.ts" --include="*.js" --include="*.json" --exclude-dir=node_modules --exclude-dir=.nx --exclude-dir=dist .
```

On Windows:

```powershell
Get-ChildItem -Recurse -File -Include *.ts,*.js,*.json |
  Where-Object FullName -notmatch 'node_modules|dist|\.nx' |
  Select-String -Pattern '@nx/module-federation|@nx/angular/mf|module-federation-dev-server|module-federation-static-server|module-federation-dev-ssr|withModuleFederationForSSR'
```

A generated webpack host has `withModuleFederation` in `webpack.config.ts` and
`webpack.prod.config.ts`, a `module-federation.config.ts`, a `build` target on
`@nx/angular:webpack-browser` with `customWebpackConfig`, and a `serve` target on
`@nx/angular:module-federation-dev-server`. A generated Rspack host has inferred targets and an
`rspack.config.ts` that merges a `webpack.config.ts` holding `NxModuleFederationPlugin` and
`NxModuleFederationDevServerPlugin`, plus a `webpack.prod.config.ts` that nothing loads. Remotes
expose `./Routes` (`./Module` for NgModule remotes) and any path `federate-module` added. Their
`serve` target depends on the host's `serve`.

Sort your hosts into two groups by reading each `src/main.ts`. Step 5 only applies to the second
group.

- **Static hosts** have no federation call in `main.ts`. They reach remotes through an
  `import('remoteA/Routes')` in the routes file, resolved by a `tsconfig.base.json` path.
- **Runtime-loaded hosts** fetch a manifest in `main.ts`. If that chain ends in `init` or
  `registerRemotes` from `@module-federation/enhanced/runtime`, the host needs no source change
  on Path A. Nx 23.2 generates `--dynamic` hosts this way. If it ends in `setRemoteDefinitions`
  from `@nx/angular/mf`, Step 5 converts it.

For server-side rendered apps (a `server` target or a `webpack.server.config.ts`), read
[migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-module-federation-ssr) before you start
Step 3.

## Path A, the official plugin on webpack or Rspack

### Step 2: install the official package

Workspaces from the `host` generator already list `@module-federation/enhanced`, usually under
`devDependencies`. Application code imports its runtime. Move it to `dependencies`, or install it
if it's missing:

**npm:**

```shell
npm add --save-prod @module-federation/enhanced
```

**pnpm:**

```shell
pnpm add -P @module-federation/enhanced
```

**yarn:**

```shell
yarn add @module-federation/enhanced
```

**bun:**

```shell
bun add @module-federation/enhanced
```

### Step 3: translate the federation config

Nx accepted a list of project names and resolved each one to a URL from the project graph. The
official plugin needs the values written out.

#### Container name and import alias

The container name is normalized. Every character outside `[a-zA-Z0-9_$]`, and a leading
character that cannot start an identifier, becomes `_`. `dyn-shell` publishes as `dyn_shell`,
and that is the form `name` takes.

The import alias stays the project name, and so do the `remoteA/Routes` entries in
`tsconfig.base.json` that a static host's `import()` resolves through:

```js
// a project named dyn-shell that consumes a project named remote-a
module.exports = {
  name: 'dyn_shell', // container, normalized
  remotes: {
    'remote-a': 'http://localhost:4201/remoteEntry.mjs', // key is the project name
  },
};
```

#### The shared map

Every app needs its own map. Copy it from that app's baseline `mf-stats.json`. Nx shared every
npm package the app depends on in the graph, plus each package's secondary entry points. Expect
entries such as `@angular/common/http` and `@angular/core/primitives/signals` that your source
never imports.

Take `singleton`, `strictVersion`, `requiredVersion`, and `eager` from each entry:

```jsonc
// dist/apps/shell/mf-stats.json, one entry of the shared array
{
  "name": "@angular/core",
  "version": "22.1.7",
  "singleton": true,
  "requiredVersion": "~22.1.0",
  "strictVersion": true,
  "eager": false,
}
```

```js
// apps/shell/module-federation.config.js
'@angular/core': { singleton: true, strictVersion: true, requiredVersion: '~22.1.0' },
```

`eager: false` is the plugin default and can be left out. Rspack stats mark most `@angular/*`
entries `eager: true`. Copy those.

Drop the `version` from npm entries. Keep it on source-only workspace libraries, which have no
`package.json` for the plugin to read. The stats show them as `version: '0.0.0'` with
`requiredVersion: '^0.0.0'` and no `strictVersion`.

#### Remote URLs

Each remote gets a full URL on its `serve` port. The host's baseline `mf-stats.json` has these
under `remotes[].federationContainerName`, one row per exposed module the host uses. Write one
entry per remote. Angular containers are ES modules, and their URLs take no `name@` prefix.

**Before:**

```ts
// apps/shell/module-federation.config.ts
import type { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: ['remoteA', 'remoteB'],
};

export default config;
```

**After:**

```js
// apps/shell/module-federation.config.js
module.exports = {
  name: 'shell', // normalized, so dyn-shell becomes dyn_shell
  filename: 'remoteEntry.mjs', // remoteEntry.js on Rspack
  library: { type: 'module' },
  dts: false,
  remotes: {
    remoteA: 'http://localhost:4201/remoteEntry.mjs', // .js on Rspack
    remoteB: 'http://localhost:4202/remoteEntry.mjs',
  },
  shared: {
    '@angular/core': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '~22.1.0',
    },
    '@angular/core/primitives/signals': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '~22.1.0',
    },
    // ... every entry the baseline mf-stats.json lists
    '@myorg/state': {
      singleton: true,
      requiredVersion: '^0.0.0',
      version: '0.0.0',
    },
  },
};
```

Every app's config carries `name`, `filename`, `library`, and `dts`. Hosts add `remotes`.
Remotes keep their existing `exposes` map, whose workspace-root paths resolve once Step 4 adds the
workspace root to `resolve.modules`.

Production remote URLs live in `webpack.prod.config.ts` as
`['remoteA', 'http://remote-a.example.com/']` tuples. On webpack the `production` configuration
loads that file through `customWebpackConfig`. Rspack never loads it. Fold those URLs into the one
config, adding the `/remoteEntry.mjs` that Nx appended for you. If the file only has the
generator's commented example, you have one URL set for every configuration.

Key the URLs on the Nx task configuration. The Angular builders don't set `NODE_ENV`.

```js
// apps/shell/module-federation.config.js
const isProd = process.env.NX_TASK_TARGET_CONFIGURATION === 'production';

module.exports = {
  // ... name, filename, library, dts, shared
  remotes: {
    remoteA: isProd
      ? 'https://remote-a.example.com/remoteEntry.mjs'
      : 'http://localhost:4201/remoteEntry.mjs',
  },
};
```

> **JavaScript config files:** The samples use CommonJS `.js`. TypeScript configs also work, and you can rename them back once
> the migration is verified.

### Step 4: replace the wrapper in the bundler config

**webpack:**

`@nx/angular:webpack-browser` passes the Angular build's webpack config to the function your
`customWebpackConfig` exports. That function was `withModuleFederation`. Replace it with one that
adds the plugin and the settings the wrapper applied.

**Before:**

```ts
// apps/shell/webpack.config.ts
import { withModuleFederation } from '@nx/module-federation/angular';
import config from './module-federation.config';

export default withModuleFederation(config, { dts: false });
```

**After:**

```js
// apps/shell/webpack.config.js
const {
  ModuleFederationPlugin,
} = require('@module-federation/enhanced/webpack');
const { join } = require('node:path');
const mf = require('./module-federation.config.js');

module.exports = (config) => ({
  ...config,
  output: { ...config.output, uniqueName: mf.name, publicPath: 'auto' },
  experiments: { ...(config.experiments ?? {}), outputModule: true },
  resolve: {
    ...config.resolve,
    modules: [
      ...(config.resolve?.modules ?? ['node_modules']),
      join(__dirname, '../..'),
    ],
    alias: {
      ...(config.resolve?.alias ?? {}),
      '@myorg/state': join(__dirname, '../../libs/state/src/index.ts'),
    },
  },
  optimization: { ...config.optimization, runtimeChunk: false },
  plugins: [...(config.plugins ?? []), new ModuleFederationPlugin(mf)],
});
```

Point `customWebpackConfig.path` at this file in `project.json`, delete the `production`
configuration's override of it, and keep `@nx/angular:webpack-browser` as the executor.

Add the `resolve.alias` entries in every federated app, hosts included. The federation plugin
resolves exposed modules outside the Angular compilation, which is the only place `tsconfig`
paths apply. Alias workspace libraries only. Aliasing a `<remote>/<exposed>` path such as
`remoteA/Routes`, `remoteNg/Module`, or a `federate-module` path bundles that remote into the
host.

**Rspack:**

The generated `rspack.config.ts` calls `createConfig` from `@nx/angular-rspack` and merges in a
`webpack.config.ts` holding `NxModuleFederationPlugin` and `NxModuleFederationDevServerPlugin`.
Keep that structure. Replace the merged file's contents and drop the dev-server plugin:

**Before:**

```ts
// apps/shell/webpack.config.ts
import { NxModuleFederationPlugin } from '@nx/module-federation/angular';
import config from './module-federation.config';

export default {
  plugins: [new NxModuleFederationPlugin({ config }, { dts: false })],
};
```

**After:**

```ts
// apps/shell/webpack.config.ts
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { join } from 'node:path';
import mf from './module-federation.config.js';

export default {
  output: { uniqueName: mf.name, publicPath: 'auto', module: true },
  resolve: { modules: ['node_modules', join(__dirname, '../..')] },
  optimization: {
    // hosts only, remotes set runtimeChunk: false unconditionally
    ...(process.env['RSPACK_SERVE'] || process.env['WEBPACK_SERVE']
      ? {}
      : { runtimeChunk: false }),
    // keeps the wrapper's chunk layout, without it one chunk is merged away
    splitChunks: { cacheGroups: { default: false, common: false } },
  },
  plugins: [new ModuleFederationPlugin(mf)],
};
```

Under the dev server, a host keeps the runtime chunk `createConfig` gives it, as the wrapper did.

Rspack containers keep `filename: 'remoteEntry.js'`. Host `remotes` URLs end in `/remoteEntry.js`,
not `.mjs`. Skip `resolve.alias`. `createConfig` reads `tsconfig` paths itself.

> **Do not add \:** Rspack builds print a `MODULE_TYPELESS_PACKAGE_JSON` warning that predates this migration. Ignore
> it. Adding `"type": "module"` breaks the CommonJS federation config.

### Step 5: convert runtime-loaded remotes

This step converts the runtime-loaded hosts from Step 1 that call `setRemoteDefinitions` from
`@nx/angular/mf`. Static hosts and hosts already on `registerRemotes` skip it.

The host keeps its manifest. Keep `ModuleFederationPlugin` in its build with `remotes: {}`.
`registerRemotes` and `loadRemote` do nothing without the runtime it creates.

**Before:**

```ts
// apps/dyn-shell/src/main.ts
import { setRemoteDefinitions } from '@nx/angular/mf';

fetch('/module-federation.manifest.json')
  .then((res) => res.json())
  .then(setRemoteDefinitions)
  .then(() => import('./bootstrap'));
```

```ts
// apps/dyn-shell/src/app/app.routes.ts
import { loadRemoteModule } from '@nx/angular/mf';

export const appRoutes: Route[] = [
  {
    path: 'remoteA',
    loadChildren: () =>
      loadRemoteModule('remoteA', './Routes').then((m) => m.remoteRoutes),
  },
];
```

**After:**

```ts
// apps/dyn-shell/src/main.ts
import { registerRemotes } from '@module-federation/enhanced/runtime';

fetch('/module-federation.manifest.json')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) =>
    registerRemotes(
      Object.entries(remotes).map(([name, entry]) => ({
        name,
        entry,
        type: 'module' as const,
      }))
    )
  )
  .then(() => import('./bootstrap'));
```

```ts
// apps/dyn-shell/src/app/app.routes.ts
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appRoutes: Route[] = [
  {
    path: 'remoteA',
    loadChildren: () =>
      loadRemote<typeof import('remoteA/Routes')>('remoteA/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
];
```

Map values must be full URLs. Append `/remoteEntry.mjs` (`/remoteEntry.js` on Rspack) to any
bare origin, which `setRemoteDefinitions` used to complete for you. A remote's `mf-manifest.json`
URL works too. Register `remoteEntry.mjs` values with `type: 'module'`. Manifest values carry
their own type.

Map keys and `loadRemote` prefixes use the normalized container name. A project named `remote-a`
is `remote_a` in the manifest and `loadRemote('remote_a/Routes')` at the call site.

### Step 6: replace the serve orchestration

`@nx/angular:module-federation-dev-server` built and served the remotes along with the host, and
`--devRemotes` picked which ones ran live. The official plugin only handles the build. You start
the processes yourself.

#### Dev servers

On webpack, switch the host's `serve` executor to `@nx/angular:dev-server`. Keep `port`,
`publicHost`, and the per-configuration `buildTarget` options. Remove `devRemotes`,
`skipRemotes`, `static`, `isInitialHost`, and `pathToManifestFile`, which the dev server rejects.
On Rspack, keep the inferred `build` and `serve` targets.

Every remote needs `headers: { 'Access-Control-Allow-Origin': '*' }`, on the `serve` target on
webpack or under `devServer.headers` in `rspack.config.ts` on Rspack. The host loads
`remoteEntry.mjs` cross-origin, and the Angular dev server sends no CORS header by default.

Keep each remote's `dependsOn: ['shell:serve']` and start everything you want live from one
`run-many`, naming each app:

```shell
nx run-many -t serve -p shell remoteA remoteB
```

#### Static servers

Replace every app's generated `serve-static` target, hosts included, with one that serves the
build output directly:

```jsonc
// apps/remoteB/project.json
{
  "targets": {
    "serve-static": {
      "executor": "@nx/web:file-server",
      "continuous": true,
      "dependsOn": ["build"],
      "options": {
        "staticFilePath": "dist/apps/remoteB", // dist/apps/remoteB/browser on Rspack
        "port": 4202,
        "spa": true,
        "watch": false,
      },
    },
  },
}
```

Replace the whole target, including `configurations` and `defaultConfiguration`. Leave
`buildTarget` unset. With it, the file server rebuilds the app on top of the `dependsOn` build,
and that nested build fails inside e2e runs. Keep `spa: true` so a refresh on a deep route
doesn't 404.

Each remote's `serve-static` port must match the port in the host's `remotes` URL.

> **Inferred targets on Rspack:** On Rspack, `@nx/rspack/plugin` infers these targets and Nx merges your `project.json` options
> into them key by key. Add `"buildTarget": ""` to clear the inferred one.

#### End-to-end projects

Generated Playwright projects start the host with `nx run shell:serve`, which no longer starts
the remotes. Point `webServer.command` at `nx run-many -t serve-static -p shell remoteA remoteB`.
A remote's own e2e project needs only `-p remoteA`, with `webServer.url` and `baseURL` on its
`serve-static` port.

Cypress projects set these commands under `nxE2EPreset` in `cypress.config.ts`:

```ts
// apps/shell-e2e/cypress.config.ts
nxE2EPreset(__filename, {
  cypressDir: 'src',
  webServerCommands: {
    default: 'nx run-many -t serve-static -p shell remoteA remoteB',
    production: 'nx run-many -t serve-static -p shell remoteA remoteB',
  },
  ciWebServerCommand: 'nx run-many -t serve-static -p shell remoteA remoteB',
});
```

#### Target defaults

In `nx.json`, drop the `{ "env": "NX_MF_DEV_REMOTES" }` input from the
`@nx/angular:webpack-browser` target default and keep the rest of the entry.

### Step 7: validate the result

Check the result in a browser against your baseline:

- Each remote route renders in the host.
- A shared mutable value written in the host reads back in each remote after a client-side route
  change.
- Editing a remote's component shows in the host after a reload, as in the baseline.
- The e2e suite passes on the replacement web server.

Then check the builds:

- Production and development both build with `--skipNxCache` after you delete `dist/apps/<app>`
  and `.angular/cache`. Build production last because both configurations write the same
  `mf-stats.json`. On Rspack, build development as
  `NGRS_CONFIG=development nx build <app> --configuration=development`.
- Each app's production `mf-stats.json` lists the same container name, remotes, exposes, and
  `shared` entries as the baseline. Compare those fields only. Asset hashes and `usedIn` text
  change.

### Step 8: clean up the old setup

Once the new setup builds and runs, delete `module-federation.config.ts`,
`webpack.prod.config.ts`, and on webpack `webpack.config.ts`. Rspack keeps `webpack.config.ts`
because `rspack.config.ts` imports it.

Then remove the package and rebuild uncached:

```shell
npm remove @nx/module-federation
```

## Path B, rewrite to native federation

Native Federation does the same runtime composition with ES modules and import maps, on the
esbuild `@angular/build:application` builder. Expect to rewrite the federation layer. Its `init`
generator expects an Angular CLI app.

### Step 2: install and initialize

Install the release matching your Angular major and minor. On Angular 22.1:

```shell
npm add @angular-architects/native-federation@~22.1.0
```

It belongs in `dependencies`.

Migrate remotes together with every host that loads them. A Module Federation host can't load a
Native Federation remote. If a host can't move yet, keep its remotes on Path A until it can.

The generator refuses an app that already has a `bootstrap.ts`. Fold `bootstrap.ts` back into
`main.ts`, delete it, and run the generator per app. On a runtime-loaded host, also drop the
`fetch(...)` chain that ends in `setRemoteDefinitions` or `registerRemotes`, keeping only the
bootstrap body. The `dynamic-host` type writes and reads its own `public/federation.manifest.json`.
Delete the old `module-federation.manifest.json`.

```shell
nx g @angular-architects/native-federation:init --project=shell --port=4200 --type=host
nx g @angular-architects/native-federation:init --project=remoteA --port=4201 --type=remote
```

Use `--type=host` for a static host and `--type=dynamic-host` for one that reads a manifest.

The generator creates `federation.config.mjs`, `tsconfig.federation.json`, a new `bootstrap.ts`
and `main.ts`, moves the app onto an `esbuild` target running `@angular/build:application`, wraps
`build` and `serve` in `@angular-architects/native-federation:build`, and adds `es-module-shims`
to the polyfills. It also adds `es-module-shims` under `dependencies` and
`@softarc/native-federation-orchestrator` under `devDependencies`, and runs an install.

The host's remote map comes from every other application's `serve` port, or `serve-original`
once that app has moved. Run the generator in any order. Apps with no port land at 4200, and
Step 3 prunes them from the map. The wrapped `serve` gets `port: 0` and falls through to the port
on `serve-original`.

Delete `dist/apps/<app>` before the first build. The new output goes under `browser/`, next to
the old webpack files. The first build also rewrites the `files` list in
`tsconfig.federation.json`. Commit after the first build that follows Step 3.

### Step 3: finish what the generator left

On an Nx Module Federation app, the generator leaves this cleanup:

- Delete `module-federation.config.ts`, `webpack.config.ts`, and `webpack.prod.config.ts`, and
  remove the `customWebpackConfig` it copied onto the `esbuild` target and its `production`
  configuration.
- Replace the placeholder `'./Component'` entry in each remote's `exposes` with the route file,
  as a path from the workspace root:
  `exposes: { './Routes': './apps/remoteA/src/app/remote-entry/entry.routes.ts' }`.
- Share workspace libraries reached through `tsconfig` paths with
  `sharedMappings: ['@myorg/state']` in every app's `federation.config.mjs`. `shareAll` only
  covers `package.json` dependencies.
- Prune the host's remote map, which lists every application with `build` and `serve` targets
  under a camel-cased key, other hosts included. With `--type=host` the map is the first argument
  of `initFederation` in `main.ts`, and with `--type=dynamic-host` it is
  `public/federation.manifest.json`. Keep the `hostRemoteEntry` option the generator writes next
  to it.
- On every app's `serve-original` target, swap the executor to `@angular/build:dev-server` and
  drop `publicHost`, which that builder does not accept. Keep a remote's `headers`.
- Point `extract-i18n` at `<app>:esbuild` on `@angular/build:extract-i18n`.
- Mark the wrapped `serve` `continuous: true`. It has no configurations. Use `serve-static` for a
  production-like local run. Give the wrapped `build` `cache: true` and `outputs`
  (`{workspaceRoot}/dist/apps/<app>`). Cache hits start from the second build.
- Move the `dependsOn: ['shell:serve']` the generator renamed onto `serve-original` back to the
  new `serve`. When a second host uses the same remotes, name every app in the `run-many`.
- Replace each app's whole `serve-static` target, `defaultConfiguration` included, with the one
  from Path A Step 6 using `staticFilePath: dist/apps/<app>/browser`, and point the e2e
  `webServer` commands at `nx run-many -t serve-static` as in that step.
- Remove the `@nx/angular:webpack-browser` entry from `targetDefaults` in `nx.json` once every
  app has moved.
- Rewrite host routes to use Native Federation's `loadRemoteModule`. Static hosts replace each
  `import('remoteA/Routes')` with the call below. Hosts on `@nx/angular/mf` swap only the import.
  Hosts calling `loadRemote('remoteA/Routes')` switch to the call below as well:

```ts
// apps/shell/src/app/app.routes.ts
import { loadRemoteModule } from '@angular-architects/native-federation';

export const appRoutes: Route[] = [
  {
    path: 'remoteA',
    loadChildren: () =>
      loadRemoteModule('remoteA', './Routes').then((m) => m.remoteRoutes),
  },
];
```

- Last, once every app has moved and no target names a webpack executor, drop the
  `remoteA/Routes` entries from `tsconfig.base.json` paths and
  `npm remove @nx/module-federation @module-federation/enhanced @nx/webpack webpack-merge`.
  Removing them earlier breaks the graph commands the other steps need.

> **loadRemoteModule is deprecated:** Native Federation 22.1 deprecates the module-level `loadRemoteModule` in favor of the one the
> `initFederation` promise resolves to. The module-level form still works with one host per page.

Builds land under `dist/apps/<app>/browser/` with a `remoteEntry.json` per app and no
`mf-stats.json`. Validate as in Path A Step 7, running the parity check against
`remoteEntry.json`:

- Every baseline npm `shared` entry appears as a singleton with the same `requiredVersion` range.
- `sharedMappings` libraries show up as `~<version>` with `strictVersion`.
- The container `name` is the project name as written, not normalized.
- Remote URLs are in `main.ts` or the manifest.

`shareAll` adds more shared packages than the old `mf-stats.json` listed. Trim them with its
`skip` option if they matter to you.

## What the official plugin does not do

- **`--devRemotes` selection.** Which remotes run live and which serve from a build is now the
  set of targets you start.
- **Automatic remote fallback.** A host fails the request when a remote is down. Add your own
  error handling if you need it.

For anything beyond this migration, use the official
[Module Federation configuration reference](https://module-federation.io/configure/) and, for
Path B, the
[Native Federation documentation](https://github.com/angular-architects/module-federation-plugin#readme).

# Migrate server-side rendered Module Federation apps

## Rules

Migrate the server build of each server-side rendered Module Federation app in this workspace off the Nx Module Federation APIs that Nx v24 removes. An app with a `server` target or a `*.server.config.*` file is server-side rendered. Migrate its browser build first with https://nx.dev/docs/kb/migrate-from-nx-module-federation (React) or Path A of https://nx.dev/docs/kb/migrate-angular-module-federation (Angular), then follow every step at https://nx.dev/docs/kb/migrate-module-federation-ssr. Native Federation is not covered, so stop and report if the user asks for it on a server-side rendered app.

Rules that override any shortcut you are tempted to take:

1. Before editing, keep the baseline stats: `dist/apps/<app>/browser/mf-stats.json`, plus `dist/apps/<app>/server/mf-stats.json` on Angular. Record the server-rendered HTML of each host route that renders a remote.
2. Replace `withModuleFederationForSSR` with `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` or `/rspack`, and drop `NxModuleFederationSSRDevServerPlugin`. Keep `@module-federation/node` as a dependency.
3. The server container sets `library: { type: 'commonjs-module' }`, `remoteType: 'script'` on both bundlers, `experiments: { asyncStartup: true }`, and `runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')]`. Its remote URLs keep the `name@` prefix and point at `<origin>/server/remoteEntry.js`, on Angular too.
4. React server builds write no stats. Reuse the browser `shared` map, with every entry `eager: true` on Rspack. Angular copies `shared` from the server stats.
5. A React host on a runtime manifest also calls `registerRemotes` in `server.ts` with the `/server` URLs. On webpack keep `@module-federation/*` inside the server bundle, or the server fails with `#RUNTIME-009`.
6. On Angular, write the server configs before the browser `module-federation.config.js`. The old server config imports it without an extension and breaks once it exists.
7. Replace the SSR dev server with watch builds plus `node --watch-path` on React, and `@angular-devkit/build-angular:ssr-dev-server` with an explicit `port` on Angular. A static run is `node dist/apps/<app>/server/<entry>.js`, never `@nx/web:file-server`.
8. Accept the migration only when each host route's HTML holds the remote's markup and client scripts, and the page hydrates in a browser without errors. Report what you verified and what you did not.

A host or remote generated with `--ssr` builds the same container twice, once for the browser and
once for Node. The browser build follows the
[React guide](https://nx.dev/docs/kb/migrate-from-nx-module-federation) or Path A of the
[Angular guide](https://nx.dev/docs/kb/migrate-angular-module-federation). The server build needs its own
container format, runtime plugin, and serve targets, covered below.

> **Scope:** React on webpack and Rspack, and Angular on webpack with the official plugin. Native Federation
> server-side rendering is not covered.

## What replaces what

| Going away in v24                                                                                                      | Replacement                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `withModuleFederationForSSR` from `@nx/module-federation/webpack`, `/rspack`, or `/angular`                            | `ModuleFederationPlugin` with the `@module-federation/node` runtime |
| `@nx/react:module-federation-ssr-dev-server`, `@nx/webpack:ssr-dev-server`, and `NxModuleFederationSSRDevServerPlugin` | `nx:run-commands` running watch builds and `node --watch-path`      |
| `@nx/angular:module-federation-dev-ssr`                                                                                | `@angular-devkit/build-angular:ssr-dev-server`                      |

## Capture the server baseline

With `--ssr`, copy the browser stats from `dist/apps/<app>/browser/mf-stats.json`. Angular
server builds also write `dist/apps/<app>/server/mf-stats.json`. Keep that one too. React server
builds write none.

Save the HTML each host route returns with `curl`. You compare against it at the end.

## Server container settings

The server container is CommonJS and loads remotes over HTTP through the Node runtime plugin.
Each remote's Express server serves its server build under `/server`, and the host's server-side
remote URLs point there. Keep that static mount in every remote's `server.ts`.

These settings apply on both frameworks:

- `library: { type: 'commonjs-module' }`. The React guide drops `library` from the browser
  config only.
- `remoteType: 'script'`, on Rspack too.
- `experiments: { asyncStartup: true }`.
- `runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')]`.
- Remote URLs such as `remoteA@http://localhost:4751/server/remoteEntry.js`, with the `name@`
  prefix and `.js` on Angular too.

Browser and server builds each need their own production URLs.

## React apps

### Server federation config

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

### Server bundler config

On webpack, the old server build is `webpack.server.config.ts` with `withModuleFederationForSSR`.
Replace it with a `webpack.server.config.js` next to the browser one:

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

On Rspack, the old server build is a second `NxModuleFederationPlugin({ config, isServer: true })`
plus an `NxModuleFederationSSRDevServerPlugin` in `rspack.config.ts`. Keep the generated
`[browser, server]` array. Both compilers get the browser guide's Step 6 settings, and the server
compiler also gets `target: 'async-node'`. Move the browser `devServer.port` off the app port,
because the Express server listens there.

### Runtime manifest on the server

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

### Targets

Add a `server` target that runs the server config, with `dependsOn: ["build"]`. For development,
replace the SSR dev server with a `serve` that watches both builds. Node restarts when the app's
server bundle or a remote's changes:

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

On Rspack, replace the two watch builds with `rspack serve`. It writes both builds to disk.

Start host and remotes together with `nx run-many -t serve -p shell remoteA -c development`.
`serve-static` becomes `node dist/apps/<app>/server/server.js` with `dependsOn: ["server"]`, in
place of `@nx/web:file-server`.

## Angular apps

A host or remote generated with `--ssr` has a `server` target on `@nx/angular:webpack-server`
whose `webpack.server.config.ts` calls `withModuleFederationForSSR`.

Do these steps before you write the Angular guide's Step 3 files. The old
`webpack.server.config.ts` imports `./module-federation.config` without an extension and breaks
once the new file exists.

### Server federation config

Write a `module-federation.server.config.js` per app. It keeps the browser config's `name`,
`exposes`, and `dts: false`, and takes the settings above:

```js
// apps/shell/module-federation.server.config.js
const isProd = process.env.NX_TASK_TARGET_CONFIGURATION === 'production';

module.exports = {
  name: 'shell',
  filename: 'remoteEntry.js',
  library: { type: 'commonjs-module' },
  remoteType: 'script',
  dts: false,
  remotes: {
    remoteA: isProd
      ? 'remoteA@https://remote-a.example.com/server/remoteEntry.js'
      : 'remoteA@http://localhost:4201/server/remoteEntry.js',
  },
  shared: {
    // ... every entry the baseline server/mf-stats.json lists
  },
  experiments: { asyncStartup: true },
  runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')],
};
```

Copy `shared` from the server stats. They list `@angular/ssr`, `@angular/ssr/node`, `express`,
and `cors` on top of the browser map.

### Server bundler config

Point `server.options.customWebpackConfig.path` at a `webpack.server.config.js`:

```js
// apps/shell/webpack.server.config.js
const {
  ModuleFederationPlugin,
} = require('@module-federation/enhanced/webpack');
const { join } = require('node:path');
const mf = require('./module-federation.server.config.js');

module.exports = (config) => ({
  ...config,
  target: 'async-node',
  output: { ...config.output, uniqueName: mf.name },
  resolve: {
    ...config.resolve,
    modules: [
      ...(config.resolve?.modules ?? ['node_modules']),
      join(__dirname, '../..'),
    ],
  },
  optimization: { ...config.optimization, runtimeChunk: false },
  plugins: [...(config.plugins ?? []), new ModuleFederationPlugin(mf)],
});
```

`main.server.ts`, `bootstrap.server.ts`, and the routes need no change. Delete
`webpack.server.config.ts` with the other old files.

### Targets

Swap the host's `serve-ssr` from `@nx/angular:module-federation-dev-ssr` to
`@angular-devkit/build-angular:ssr-dev-server`. Keep `browserTarget` and `serverTarget`, and add
an explicit `port`. Remotes keep their `serve-ssr` target. Start them together:

```shell
nx run-many -t serve-ssr -p shell remoteA
```

Restart the host's `serve-ssr` to pick up a remote's server-side changes.

For a production-like run, start `node dist/apps/<app>/server/main.js` with `PORT` set.

## Validate the result

Request each host route that renders a remote, for example with `curl`, and check that the
response holds the remote's markup and the client `<script>` tags. Then load it in a browser and
check that it hydrates without errors.

Keep `@module-federation/node` in `dependencies` when you remove `@nx/module-federation`.

## What the official plugins do not do

- **Dev orchestration.** The SSR dev-server executors started the remotes with the host and
  proxied the static ones. Start each app's `serve` or `serve-ssr` yourself.
