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

Rules that override any shortcut you are tempted to take. Rules 2 to 7 are Path A. On Path B follow that section of the page instead:

1. Before editing, run production builds and keep every `mf-stats.json`: `dist/apps/<app>/mf-stats.json` on webpack, `dist/apps/<app>/browser/mf-stats.json` on Rspack. Its `shared` array, `exposes`, and container name are what you reproduce. On a generated Rspack app, raise the initial `maximumError` budget if the production build fails on it.
2. Replace `withModuleFederation` and `NxModuleFederationPlugin` from `@nx/module-federation/angular` with `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` or `/rspack`, and drop `NxModuleFederationDevServerPlugin`. Keep `@nx/angular:webpack-browser` with `customWebpackConfig` on webpack, and `createConfig` from `@nx/angular-rspack` on Rspack.
3. Browser containers are ES modules: set `library: { type: 'module' }`, `experiments.outputModule: true` on webpack or `output.module: true` on Rspack, `filename: 'remoteEntry.mjs'` on webpack and `remoteEntry.js` on Rspack, `dts: false`, `output.publicPath: 'auto'`, `output.uniqueName`, and `optimization.runtimeChunk: false`. An Rspack host keeps its runtime chunk under the dev server. Write `remotes` as plain URLs with no `name@` prefix, one entry per remote even when the host stats list it once per exposed module.
4. On webpack, add `resolve.alias` entries for every workspace library referenced through `tsconfig` paths, never for a `<remote>/<exposed>` entry such as `remoteA/Routes`, `remoteNg/Module`, or a `federate-module` path. Exposed modules are resolved outside the Angular compilation, so remotes fail to build without them. Rspack's `createConfig` reads the paths itself, so no alias there.
5. A host that already calls `registerRemotes` from `@module-federation/enhanced/runtime` is done, including `mf-manifest.json` entries with no `type`. For hosts on `@nx/angular/mf`, convert `setRemoteDefinitions` to `registerRemotes` with `type: 'module'` and `loadRemoteModule(name, './Routes')` to `loadRemote('<container-name>/Routes')`. Map keys and `loadRemote` prefixes are the normalized container name. Map values must be full `remoteEntry.mjs` URLs (`remoteEntry.js` on Rspack).
6. On webpack, replace the `serve` target with `@nx/angular:dev-server`. On Rspack keep the inferred targets. Keep each remote's `dependsOn: ['<host>:serve']`, set `headers: { 'Access-Control-Allow-Origin': '*' }` on every remote's serve target (on Rspack under `devServer.headers` in `rspack.config.ts`), and add a `serve-static` target per app using `@nx/web:file-server` with `staticFilePath`, `dependsOn: ['build']`, `spa: true`, `watch: false`, never `buildTarget`. Point Playwright `webServer.command`, or Cypress `webServerCommands` and `ciWebServerCommand`, at `nx run-many -t serve-static -p <host> <remotes>`.
7. Remove `@nx/module-federation` only after the new setup builds and runs. Move `@module-federation/enhanced` to `dependencies` (`pnpm add -P` on pnpm). Rebuild uncached, production last. On Rspack a development build needs `NGRS_CONFIG=development`.
8. Do not claim hot-update parity or shared-state parity from a green build. Remote edits reach the host after a reload, before and after this migration. Report what you verified and what you did not.
9. On Path B, install the `@angular-architects/native-federation` release matching the workspace's Angular major and minor. A host calling `loadRemote('remoteA/Routes')` switches to `loadRemoteModule('remoteA', './Routes')`.
10. For apps with a server build (a `server` target or a `webpack.server.config.*` file), also follow https://nx.dev/docs/kb/migrate-module-federation-ssr before Step 3. Path B does not cover server-side rendering, so stop and report if the user asks for Path B on one.

Nx v23 deprecates the Angular Module Federation generators, executors, runtime helpers, and the
`withModuleFederation` and `NxModuleFederationPlugin` wrappers in `@nx/module-federation/angular`.
Nx v24 will remove them. Module Federation itself keeps working. Nx provided wrappers and runtime
helpers over the official [Module Federation](https://module-federation.io) plugin, and that
plugin stays supported on both webpack and Rspack.

Migrate before you upgrade to v24, while the old packages still work and you can compare the
result against a baseline you captured yourself. Nx will also ship migrations for this later.

You have one decision to make before you start:

- **Path A** keeps your bundler and swaps the wrapper for the official plugin. Your build target,
  routes, and deployment model stay the same. It is the conservative option and the smallest diff.
- **Path B** moves to [Native Federation](https://www.npmjs.com/package/@angular-architects/native-federation)
  and onto the esbuild-based `@angular/build:application` builder. It is the larger change, and
  the one more likely to track Angular's own direction.

> **Scope:** Static and runtime-loaded remotes. Server-side rendered (`--ssr`) apps take Path A plus
> [migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-module-federation-ssr). Path B does not cover
> them. For
> React, see the [React guide](https://nx.dev/docs/kb/migrate-from-nx-module-federation).

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

The last two coordinated processes rather than built code, and this migration skips them.
`NxModuleFederationDevServerPlugin` is the Rspack form of the dev-server executor, which started
each remote alongside the host so one `nx serve` brought the whole system up.
`module-federation-static-server` served every remote you were not developing from a single port.
Step 6 replaces both with targets you name yourself.

## Capture a baseline first

Federation failures are quiet: a remote renders correctly while the host and the remote hold
separate copies of a shared library. Record what works now, so you have something to compare
against:

- Serve one host at a time with its remotes, and visit the routes that load each remote. The old
  executor serves static remotes on a port above the host's, which can be another host's port.
- Edit a file in the host and in a remote, and note how each change reaches the page.
- Copy each `mf-stats.json` out of `dist` into a folder of its own, such as `baseline/`, before
  you rebuild. On webpack it sits at `dist/apps/<app>/mf-stats.json`, and on Rspack at
  `dist/apps/<app>/browser/mf-stats.json`. It holds the resolved
  `shared` map, the `exposes`, and the container name that both paths reproduce.
- Note each app's `serve` port, which the remote URLs in Step 3 use.

Generated workspaces can need fixes before the baseline builds:

- Remote names must be valid identifiers. The `host` generator rejects `remote-a`, so use
  `remoteA`.
- Rspack apps generated by Nx 23.2 can exceed their 1 MB initial budget, since `remoteEntry.js`
  counts as initial. Raise `maximumError` before the production build.
- webpack 5.111 and later fail every production build with `@module-federation/enhanced` 2.9.2 on
  `Path variable [contenthash:20] not implemented`. Pin webpack to 5.110 or earlier until
  upstream fixes it.

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
`NxModuleFederationDevServerPlugin`. Its `webpack.prod.config.ts` is never loaded. Remotes expose
`./Routes`, or `./Module` for NgModule remotes, plus any path `federate-module` added, and their
`serve` target carries a `dependsOn` on the host's `serve`.

Group your hosts, since Step 5 (runtime remotes) only applies to the second kind. Read each
host's `src/main.ts` to tell them apart:

- **Static hosts** have no federation call in `main.ts`. They reach remotes through an
  `import('remoteA/Routes')` in the routes file, resolved by a `tsconfig.base.json` path.
- **Runtime-loaded hosts** fetch a manifest in `main.ts`. If that chain ends in `init` or
  `registerRemotes` from `@module-federation/enhanced/runtime`, the host needs no source change
  on Path A. Nx 23.2 generates `--dynamic` hosts this way. If it ends in `setRemoteDefinitions`
  from `@nx/angular/mf`, Step 5 converts it.

An app with a `server` target or a `webpack.server.config.ts` is server-side rendered. Read
[migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-module-federation-ssr) before Step 3, since
its server config imports the file Step 3 replaces.

## Path A, the official plugin on webpack or Rspack

### Step 2: install the official package

A workspace built by the `host` generator already has `@module-federation/enhanced` in its root
`package.json`, under `devDependencies` on recent versions. Move it to `dependencies`, since
application code imports the runtime, then run your package manager's install so the lockfile
follows. Install it if it is missing:

**npm:**

```shell
npm add --save-prod @module-federation/enhanced
```

**pnpm:**

```shell
pnpm add -P @module-federation/enhanced
```

Without `-P`, pnpm leaves an existing devDependency where it is.

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
official plugin takes explicit values, so write them out.

#### Container name and import alias

The container name is normalized. Every character outside `[a-zA-Z0-9_$]`, and a leading
character that cannot start an identifier, becomes `_`, so `dyn-shell` publishes as `dyn_shell`.
Use that form for `name`.

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

Every app needs its own map, read from that app's baseline `mf-stats.json` rather than derived.
Nx emitted every npm package the graph resolves as a dependency of the app and then added every
secondary entry point of each one, so the map holds entries such as `@angular/common/http` and
`@angular/core/primitives/signals` that nothing in your source imports.

Copy the stats one entry at a time, taking `singleton`, `strictVersion`, `requiredVersion`, and
`eager` from each:

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

Two things to watch:

- **`eager: false` is the plugin default** and can be omitted. On Rspack the stats mark most
  `@angular/*` entries `eager: true`, so read rather than assume.
- **Leave out the `version` npm entries carry.** Keep it only for a source-only workspace
  library, which the stats emit with `requiredVersion: '^0.0.0'`, `version: '0.0.0'`, and no
  `strictVersion`, because it has no `package.json` for the plugin to read.

#### Remote URLs

A full URL on each remote's `serve` port, which the host's baseline `mf-stats.json` lists
verbatim as `remotes[].federationContainerName`. The host stats list a remote once per exposed
module it consumes, so write one entry per alias. A remote's own stats has an empty `remotes`
array. Angular containers are ES modules, so the URL has no `name@` prefix.

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

Every app's config carries `name`, `filename`, `library`, and `dts`. `remotes` and `exposes` are
the per-role parts, and remote configs keep the `exposes` map they have. The generator wrote that
exposed path relative to the workspace root, which the plugin resolves once Step 4 puts the
workspace root on `resolve.modules`.

Generated apps also carry `webpack.prod.config.ts`, holding production remote URLs as
`['remoteA', 'http://remote-a.example.com/']` tuples, wired through
`build.configurations.production.customWebpackConfig` on webpack. On Rspack the file exists but
`rspack.config.ts` never loads it. Nx appended `/remoteEntry.mjs` to a tuple URL without a
filename. Fold both sets into the one config and write the full entry URL. A file that still
holds only the generator's commented example means one URL set for every configuration.

The Angular builders do not set `NODE_ENV`, so key on the Nx task configuration instead:

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

> **JavaScript config files:** The samples use CommonJS `.js`, which the builder loads without a TypeScript loader. A `.ts` file
> keeps working, so renaming them back is a reasonable follow-up once the migration is verified.

### Step 4: replace the wrapper in the bundler config

**webpack:**

`@nx/angular:webpack-browser` passes the Angular build's webpack config to the function your
`customWebpackConfig` exports. `withModuleFederation` was that function, so replace it with one
that adds the plugin and the settings the wrapper used to set.

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

Add the `resolve.alias` entries in every federated app, hosts included. The Angular build
resolves `tsconfig` paths for the app's own code, but the federation plugin resolves an exposed
module outside that path, so on a clean build a remote whose exposed routes import a workspace
library fails with `Can't resolve '@myorg/state'`. Alias libraries only, or the remotes get
bundled into the host. That rules out every `<remote>/<exposed>` path, such as `remoteA/Routes`,
`remoteNg/Module`, and the paths `federate-module` added.

**Rspack:**

The generated `rspack.config.ts` builds the Angular config with `createConfig` from
`@nx/angular-rspack` and merges a `webpack.config.ts` that held `NxModuleFederationPlugin` and
`NxModuleFederationDevServerPlugin`. The second is the Rspack form of the dev-server
orchestration and goes away with Step 6. Keep that structure and replace the merged file's
contents:

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

A host keeps the runtime chunk `createConfig` gives it under the dev server, as the wrapper did.
Without it every development page load throws `Cannot use 'import.meta' outside a module`.

Rspack containers keep `filename: 'remoteEntry.js'`, so the host's `remotes` URLs end in
`/remoteEntry.js` there, not `.mjs`. No `resolve.alias` is needed, since `createConfig` reads
`tsconfig` paths itself.

> **Do not add \:** Every Rspack build prints a `MODULE_TYPELESS_PACKAGE_JSON` warning that predates this migration.
> Following its advice breaks the CommonJS federation config.

### Step 5: convert runtime-loaded remotes

This step applies to the hosts you grouped as runtime-loaded in Step 1, whose `src/main.ts`
calls `setRemoteDefinitions` from `@nx/angular/mf`. A host whose `main.ts` has no federation call
is static and needs nothing here. One already calling `init` or `registerRemotes` from
`@module-federation/enhanced/runtime` is done, including the Nx 23.2 `--dynamic` form that
registers `mf-manifest.json` URLs with no `type` and routes through `loadRemote`.

The host keeps its manifest and changes how it feeds it in. Keep `ModuleFederationPlugin` in the
host's own build with `remotes: {}`, since it creates the runtime that `registerRemotes` and
`loadRemote` attach to, and without it they silently do nothing.

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

Two things to get right:

- **Every map value is a full URL.** `setRemoteDefinitions` completed a bare origin for you, so
  append `/remoteEntry.mjs` (`/remoteEntry.js` on Rspack) to any entry that lacks a filename, or
  the remote 404s at navigation time. A remote's `mf-manifest.json` URL also works. `type: 'module'`
  is required for a `remoteEntry.mjs` value, while a manifest value carries its own type. These
  URLs are not in the host's `mf-stats.json`, whose `remotes` array is empty.
- **Keys and `loadRemote` prefixes are the normalized container name.** Registration replaces the
  alias, so a project named `remote-a` is `remote_a` in the manifest and
  `loadRemote('remote_a/Routes')` at the call site.

### Step 6: replace the serve orchestration

`@nx/angular:module-federation-dev-server` built the remotes and served them behind the host,
with `--devRemotes` picking which ones ran live. The official plugin federates the build and does
not coordinate processes, so you start the set you want.

#### Dev servers

On webpack, move the host's `serve` to `@nx/angular:dev-server`, swapping only the executor.
`port`, `publicHost`, and the per-configuration `buildTarget` options stay, while `devRemotes`,
`skipRemotes`, `static`, `isInitialHost`, and `pathToManifestFile` go, since the dev server
rejects them. On Rspack, keep the inferred `build` and `serve` targets.

Every remote needs `headers: { 'Access-Control-Allow-Origin': '*' }`, on the `serve` target on
webpack and under `devServer.headers` in `rspack.config.ts` on Rspack. Check whether it is
already there before adding it. The host loads `remoteEntry.mjs` as a cross-origin module, and
the Angular dev server sets no CORS header. The old executor enabled CORS only for the remotes it
served statically, so `--devRemotes` fails the same way on Nx 23.

Keep each remote's `dependsOn: ['shell:serve']`, then start everything you want live in one Nx
process, naming each app. The generated `dependsOn` names one host, so a second host does not
come up through a remote, and remotes started in separate terminals each wait for `shell:serve`
in another process and exit:

```shell
nx run-many -t serve -p shell remoteA remoteB
```

#### Static servers

Every federated app already has a `serve-static` target, written in the `buildTarget` form.
Replace it, on hosts as well as remotes, with one that serves the build output directly:

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

Replace the generated target whole, `configurations` and `defaultConfiguration` included, since
both only carried a per-configuration `buildTarget`. Serve the output with `staticFilePath` and
leave `buildTarget` unset, since the file server rebuilds the app itself whenever that option is
present, which duplicates the `dependsOn` build and can fail with
`Recursive task invocation detected` from inside an e2e run that already built it. Keep
`spa: true` on every app, or a refresh on a deep route returns a 404.

Each remote's `serve-static` port has to be the port the host's `remotes` URL names, or the host
404s on `remoteEntry.mjs` against a web server that started cleanly.

> **Inferred targets on Rspack:** On Rspack these targets come from `@nx/rspack/plugin` inference, and Nx merges your `project.json`
> options over the inferred ones key by key. The inferred `buildTarget` therefore arrives next to
> your `staticFilePath`. Add `"buildTarget": ""` to your target to clear it.

#### End-to-end projects

The generated Playwright project starts the host with `nx run shell:serve`, which used to bring
the remotes with it. Point its `webServer.command` at
`nx run-many -t serve-static -p shell remoteA remoteB`. A remote's own e2e project serves only
that remote, `-p remoteA`, with `webServer.url` and the config's `baseURL` on its `serve-static`
port.

A generated Cypress project sets the same commands under `nxE2EPreset` in `cypress.config.ts`.
Point `webServerCommands.default`, `webServerCommands.production`, and `ciWebServerCommand` at
the same `run-many` command:

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

A green build is not the acceptance criterion. The migration is done when, in a browser against
the baseline:

- Each remote route renders in the host.
- A shared mutable value written in the host reads back in each remote after a client-side route
  change.
- Editing a remote's component shows in the host after a reload, the same as in the baseline. On
  Rspack, reload once after the dev server starts, since the first load can stall on lazy
  compilation before and after the migration.
- The e2e suite passes on the replacement web server.

Plus, on the build side:

- Production and development configurations both build with `--skipNxCache` after you delete
  `dist/apps/<app>` and `.angular/cache`. Build production last, since both configurations write
  the same `mf-stats.json`. On Rspack, `createConfig` picks the configuration from `NGRS_CONFIG`,
  so run `NGRS_CONFIG=development nx build <app> --configuration=development`. Without the
  variable the build exits 0 with production output.
- Each app's production `mf-stats.json` lists the same container name, remotes, exposes, and
  `shared` entries as the baseline. Compare those fields rather than the whole file, since asset
  hashes and the `usedIn` text differ.

> **A remote that fails to load after a rebuild:** `Cannot read properties of undefined (reading 'call')` or `Cannot find module '<id>'` while
> loading `"./Routes"` means a stale cache. Run `nx reset`, delete `.angular/cache`, and rebuild
> before you look anywhere else.

### Step 8: clean up the old setup

Once the new setup builds and runs, delete the files it replaced: `module-federation.config.ts`
and `webpack.prod.config.ts`, plus `webpack.config.ts` on webpack. On Rspack `webpack.config.ts`
stays, since `rspack.config.ts` imports it.

Then remove the package:

```shell
npm remove @nx/module-federation
```

Its absence from `package.json` proves nothing on its own, so rebuild uncached afterwards with
any remaining copy renamed aside for that one build, then put it back:

- On npm, `@nx/angular` lists it as an optional peer dependency, so on a webpack workspace
  `npm remove` takes it out of `node_modules`. `@nx/rspack` depends on it, so on an Rspack
  workspace `node_modules/@nx/module-federation` stays.
- On pnpm, `pnpm remove` drops the root link. `autoInstallPeers`, which `create-nx-workspace`
  turns on, keeps a copy under `node_modules/.pnpm/@nx+module-federation@*/` for `@nx/angular`
  and `@nx/rspack`.

## Path B, rewrite to native federation

Native Federation implements the same runtime composition on ES modules and import maps, on top
of the esbuild `@angular/build:application` builder. The migration is a rewrite of the federation
layer rather than a swap, and its `init` generator expects an Angular CLI app shape.

### Step 2: install and initialize

Install the release that matches your Angular major and minor, since `latest` can require a newer
`@angular/build` than the workspace has. On Angular 22.1:

```shell
npm add @angular-architects/native-federation@~22.1.0
```

It goes under `dependencies`, since application code imports its runtime.

Migrate remotes together with every host that loads them. A Module Federation host, on Path A or
still on the Nx wrappers, cannot load a Native Federation remote: its `remoteEntry.mjs` request
returns 404 the moment the remote moves. If a host cannot move yet, keep that remote building on
Path A as well until it can.

The generator refuses an Nx Module Federation app as generated, because `bootstrap.ts` already
exists and `main.ts` does not call `initFederation`. Fold `bootstrap.ts` back into `main.ts` and
delete it, then run the generator per app. On a runtime-loaded host, drop the
`fetch(...)` chain that ends in `setRemoteDefinitions` or `registerRemotes` as well and keep only
the bootstrap body, since the
`dynamic-host` type writes `public/federation.manifest.json` and reads it itself. Delete the old
`module-federation.manifest.json`.

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

It builds the host's remote map from every other application's `serve` port, or its
`serve-original` port once that app has moved, so the order does not matter. An app with no port
lands at 4200, which is why the map always needs the pruning in Step 3. The wrapped `serve` gets
`port: 0`, which falls through to the real port on `serve-original`.

Delete `dist/apps/<app>` before the first build, since the new build writes under `browser/` and
leaves the old webpack output next to it. The first build rewrites the `files` list in
`tsconfig.federation.json`, replacing `src/main.ts` with the shared mappings and exposed files,
so commit after the first build that follows Step 3.

### Step 3: finish what the generator left

The generator assumes an Angular CLI app with no federation, so on an Nx Module Federation app it
leaves this cleanup:

- Delete `module-federation.config.ts`, `webpack.config.ts`, and `webpack.prod.config.ts`, and
  remove the `customWebpackConfig` it copied onto the `esbuild` target and its `production`
  configuration.
- Replace the placeholder `'./Component'` entry under each remote's `exposes`, which fails the
  build until replaced, with the route file as a path from the workspace root:
  `exposes: { './Routes': './apps/remoteA/src/app/remote-entry/entry.routes.ts' }`.
- Share workspace libraries reached through `tsconfig` paths with
  `sharedMappings: ['@myorg/state']` in every app's `federation.config.mjs`, since `shareAll`
  covers only `package.json` dependencies.
- Prune the host's remote map, which lists every application with `build` and `serve` targets
  under a camel-cased key, other hosts included. With `--type=host` the map is the first argument
  of `initFederation` in `main.ts`, and with `--type=dynamic-host` it is
  `public/federation.manifest.json`. Keep the `hostRemoteEntry` option the generator writes next
  to it.
- On every app's `serve-original` target, swap the executor to `@angular/build:dev-server` and
  drop `publicHost`, which that builder does not accept. Keep a remote's `headers`.
- Point `extract-i18n` at `<app>:esbuild` on `@angular/build:extract-i18n`.
- Mark the wrapped `serve` `continuous: true`. It has no configurations, so a production-like
  local run is `serve-static`. Give the wrapped `build` `cache: true` with `outputs`
  (`{workspaceRoot}/dist/apps/<app>`) so Nx caches it. The first build's rewrite of
  `tsconfig.federation.json` is its own input, so the cache settles from the second build.
- Move the `dependsOn: ['shell:serve']` the generator renamed onto `serve-original` back to the
  new `serve`. It names one host, so name every app you want up in the `run-many` when a second
  host consumes the same remotes.
- Replace each app's whole `serve-static` target, `defaultConfiguration` included, with the one
  from Path A Step 6 using `staticFilePath: dist/apps/<app>/browser`, and point the e2e
  `webServer` commands at `nx run-many -t serve-static` as in that step.
- Remove the `@nx/angular:webpack-browser` entry from `targetDefaults` in `nx.json` once every
  app has moved.
- Rewrite host routes to load through Native Federation. A static host replaces each
  `import('remoteA/Routes')` with the call below. A runtime-loaded host on `@nx/angular/mf` keeps
  the same `loadRemoteModule('remoteA', './Routes')` call and swaps the import, and one calling
  `loadRemote('remoteA/Routes')` switches to it:

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
  Removing them before the target swaps above breaks the graph commands you need for the rest.

> **loadRemoteModule is deprecated:** Native Federation 22.1 deprecates the module-level `loadRemoteModule` in favor of the one the
> `initFederation` promise resolves to. The module-level form still works with one host per page.

Builds land under `dist/apps/<app>/browser/` with a `remoteEntry.json` per app instead of
`remoteEntry.mjs`, and there is no `mf-stats.json`. Validate as in Path A Step 7, with one change
to the parity check, read from `remoteEntry.json`. Remote URLs live in `main.ts` or the manifest
rather than there. Every baseline npm `shared` entry appears as a singleton with the same
`requiredVersion` range, `sharedMappings` libraries come out as `~<version>` with `strictVersion`,
extra entries from `shareAll` are fine, and the container `name` is the project name as written
rather than the normalized form the old stats show.

`shareAll` shares every `package.json` dependency, so the remote entry lists more packages than
the old `mf-stats.json`. Use `skip` to trim it if the extra shared packages matter to you.

## What the official plugin does not do

- **`--devRemotes` selection.** Which remotes run live and which serve from a build is now the
  set of targets you start.
- **Automatic remote fallback.** A host whose remote is unavailable fails the request, so add
  your own error handling if you need one.

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
4. React server builds write no stats, so reuse the browser `shared` map, with every entry `eager: true` on Rspack. Angular copies `shared` from the server stats.
5. A React host on a runtime manifest also calls `registerRemotes` in `server.ts` with the `/server` URLs. On webpack keep `@module-federation/*` inside the server bundle, or the server fails with `#RUNTIME-009`.
6. On Angular, write the server configs before the browser `module-federation.config.js` lands, since the old server config imports it without an extension.
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

With `--ssr`, the browser stats move to `dist/apps/<app>/browser/mf-stats.json`, so copy them from
there. Angular server builds also write `dist/apps/<app>/server/mf-stats.json`, which you need
too. React server builds write none.

Save the HTML each host route returns with `curl`, so you can check that the migrated server
still renders the remote's markup.

## Server container settings

The server container is CommonJS and loads remotes over HTTP through the Node runtime plugin. Each
remote's Express server serves its server build under `/server`, which is where the host's
server-side remote URLs point. Keep that static mount in every remote's `server.ts`.

These settings apply on both frameworks:

- `library: { type: 'commonjs-module' }`. The React guide drops `library` from the browser
  config only.
- `remoteType: 'script'`, on Rspack too.
- `experiments: { asyncStartup: true }`.
- `runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')]`.
- Remote URLs of the form `remoteA@http://localhost:4751/server/remoteEntry.js`. The server
  container keeps the `name@` prefix and `.js` even on Angular, whose browser container is an ES
  module.

Production browser and server URLs are separate sets, so give each its own per-environment
values.

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

The spread reuses the browser `shared` map, since the server build writes no stats to copy from.
On Rspack, the old server config marked every entry `eager: true`, so keep that there.

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
and an `NxModuleFederationSSRDevServerPlugin` in `rspack.config.ts`. Keep the generated
`[browser, server]` array, give both compilers the browser guide's Step 6 settings, set
`target: 'async-node'` on the server compiler, and move the browser `devServer.port` off the app
port, which the Express server owns.

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

On webpack with `externalDependencies: 'all'`, this import resolves to a second copy of the
runtime and the server fails with `#RUNTIME-009`. Keep `@module-federation/*` inside the bundle by
switching to `externalDependencies: 'none'` and `mergeExternals: true`, with your own `externals`
function that skips that scope.

### Targets

Add a `server` target that runs the server config, with `dependsOn: ["build"]`. For development,
replace the SSR dev server with a `serve` that watches both builds and restarts Node when the
app's server bundle or a remote's changes. The host process caches a remote's container until it
restarts:

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

On Rspack, `rspack build --watch` rejects an array config, so run `rspack serve`, which writes
both builds to disk, next to the `node --watch-path` command. Start host and remotes together
with `nx run-many -t serve -p shell remoteA -c development`.

For `serve-static`, run `node dist/apps/<app>/server/server.js` with `dependsOn: ["server"]`,
since `@nx/web:file-server` serves client-rendered HTML only.

## Angular apps

A host or remote generated with `--ssr` has a `server` target on `@nx/angular:webpack-server`
whose `webpack.server.config.ts` calls `withModuleFederationForSSR`.

Do these steps before the Angular guide's Step 3 files land. The untouched
`webpack.server.config.ts` imports `./module-federation.config` without an extension, so it picks
up the new CommonJS file and the server build fails with
`Cannot read properties of undefined (reading 'name')`.

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

Copy `shared` from the server stats, which add `@angular/ssr`, `@angular/ssr/node`, `express`, and
`cors` to the browser map.

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

The host caches a remote's server container, so restart the host's `serve-ssr` to pick up a
remote change on the server.

A production-like run is `node dist/apps/<app>/server/main.js` with `PORT` set, since
`serve-static` on `@nx/web:file-server` serves client-rendered HTML only.

## Validate the result

Request each host route that renders a remote, for example with `curl`, and check that the
response holds the remote's markup and the client `<script>` tags. Then load it in a browser and
check that it hydrates without errors.

Keep `@module-federation/node` in `dependencies` when you remove `@nx/module-federation`.

## What the official plugins do not do

- **Dev orchestration.** The SSR dev-server executors started the remotes with the host and
  proxied the static ones. Start each app's `serve` or `serve-ssr` yourself.
