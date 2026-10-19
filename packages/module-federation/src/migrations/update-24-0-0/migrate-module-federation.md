# Migrate apps off Nx Module Federation

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
- The agent context groups projects by framework. Follow the React guide below for React projects
  and the Angular guide for Angular projects, and skip a guide when no project needs it. The React
  guide's instruction to stop on Angular apps does not apply here.
- Remove `@nx/module-federation` from `package.json` only after no file in the workspace imports
  it and every migrated app, React and Angular, builds.

# Migrate React apps off Nx Module Federation

## Rules

Migrate this workspace off the Nx Module Federation APIs that Nx v24 removes, keeping each app's current bundler. Follow every step at https://nx.dev/docs/kb/migrate-from-nx-module-federation in order. Scope is React on Rspack and webpack. Stop and report if you find Angular apps.

Rules that override any shortcut you are tempted to take:

1. Before editing, run production builds and keep every `dist/apps/<app>/mf-stats.json`. Its `shared` array, `exposes`, and container name are what you reproduce. Do not derive sharing from package.json. If a host build fails with `Cannot find remote "<kebab-name>"`, rename the generated remote entries to the project names first. If webpack production builds fail with `Path variable [contenthash:20] not implemented`, pin webpack to 5.110 or earlier.
2. Replace `withModuleFederation` and `NxModuleFederationPlugin` with `ModuleFederationPlugin` from `@module-federation/enhanced/rspack` or `/webpack`, and drop `NxModuleFederationDevServerPlugin`. Keep `NxAppRspackPlugin`, `NxAppWebpackPlugin`, `NxReactRspackPlugin`, `NxReactWebpackPlugin`. Do not switch bundlers or regenerate apps.
3. Set `name` to the project name with every character outside `[a-zA-Z0-9_$]` replaced by `_`, plus `filename: 'remoteEntry.js'`, `dts: false`, and `remoteType: 'script'` on webpack. Drop any `library` entry.
4. Write the `shared` map from the baseline `mf-stats.json`, copying `singleton`, `strictVersion`, `requiredVersion`, and `eager` per entry. Secondary entry points are separate keys. Give a source-only workspace library an explicit `version`, the stats value if it has no `package.json`. A workspace library imported by more than one app but missing from the stats was never shared. Sharing it now changes behavior. Report it.
5. Move a static host to a runtime manifest: `registerRemotes` with `type: 'global'` and full `remoteEntry.js` URLs, `loadRemote('<container-name>/<exposed>')` at the call sites (map a named export to `default`), and `implicitDependencies` on the host. A host that already calls `registerRemotes` is done as it is, including `mf-manifest.json` entries with no `type`. Keep static `remotes` entries only if the user asks to stay static.
6. Restore the bundler settings the wrapper used to set: `output.uniqueName`, `output.publicPath: 'auto'`, `output.clean: true`, app-plugin `commonChunk: false`, `devServer.hot: true` with an `Access-Control-Allow-Origin` header, `lazyCompilation: false` on Rspack, and `output.scriptType: 'text/javascript'` on webpack. `optimization.runtimeChunk` and the app-plugin `runtimeChunk` are `false` on remotes and on host production builds, and `'single'` (app-plugin `true`) on host development builds. Keep `extractLicenses` on for production only. Delete the old `module-federation.config.ts`, `rspack.config.ts` or `webpack.config.ts`, and `*.config.prod.*` in the same step you write the `.js` replacements.
7. Move `build` and `serve` to `nx:run-commands` running the Rspack or webpack CLI, with `NODE_ENV` per configuration and `readyWhen: { signal: true }` on `serve`. Add a `serve-static` target per app using `@nx/web:file-server` with `staticFilePath`, `dependsOn: ['build']`, `spa: true`, `watch: false`, `readyWhen: { signal: true }`, never `buildTarget`. Make each e2e task wait for every app's `serve-static`. On Playwright, list one `webServer` entry per app running `npx nx run <app>:serve-static`, with its `url` and `reuseExistingServer: true`. On Cypress, convert any `@nx/cypress:cypress` target to the inferred task, point `webServerCommands` at `npx nx run <host>:serve-static`, and give the e2e target `dependsOn: [{ projects: [<host>, <remotes>], target: 'serve-static', waitFor: 'ready' }]`. With a `ciWebServerCommand`, point it there too and give the atomized `e2e-ci--*` tasks the same `dependsOn` through a `targetDefaults` entry filtered to the e2e project. Never start the apps with `nx run-many` from an e2e web server command or a `run-commands` target.
8. Remove `@nx/module-federation` only after the new setup builds and runs. On v23, `@nx/rspack` depends on it, so on Rspack rebuild uncached with the `node_modules` copy renamed aside, then put it back.
9. Do not claim hot-update parity, shared-state parity, or deployment-path correctness from a green build. Serve one remote alone with `nx serve <remote>`, and check that the host boots and that remote's route renders. Run the development flow with at least one remote served statically, and edit a host file and a live remote file to check hot updates. Report what you verified and what you did not.
10. For apps with a server build (a `server` target or a `*.server.config.*` file), also follow https://nx.dev/docs/kb/migrate-react-module-federation-ssr.

Nx v23 deprecates the Module Federation wrappers, runtime helpers, dev-server executors, and
generators that `@nx/module-federation`, `@nx/react`, `@nx/rspack`, and `@nx/angular` ship today.
These APIs wrap the official [Module Federation](https://module-federation.io) plugins. Nx v24
removes the wrappers, so migrate your apps to the official plugins directly and keep each app on
its current bundler.

Migrate before you upgrade to v24, while the old setup still builds and you can compare against
it. Nx will also ship migrations for this later.

> **Scope:** React apps on Rspack or webpack, keeping the same bundler. Server-side rendered apps follow these
> steps for the browser build, then
> [migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-react-module-federation-ssr). For Angular, see
> [migrate Angular Module Federation](https://nx.dev/docs/kb/migrate-angular-module-federation).

## What replaces what

| Going away in v24                                                                     | Replacement                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `withModuleFederation` from `@nx/module-federation/rspack`                            | `ModuleFederationPlugin` from `@module-federation/enhanced/rspack`  |
| `withModuleFederation` from `@nx/module-federation/webpack`                           | `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` |
| `NxModuleFederationPlugin` from `@nx/module-federation/rspack`                        | `ModuleFederationPlugin` from `@module-federation/enhanced/rspack`  |
| `setRemoteDefinitions`, `setRemoteDefinition` from `@nx/react/mf`                     | `registerRemotes` from `@module-federation/enhanced/runtime`        |
| `loadRemoteModule` from `@nx/react/mf`                                                | `loadRemote` from `@module-federation/enhanced/runtime`             |
| `@nx/react:module-federation-dev-server` and the Rspack equivalent                    | `nx:run-commands` running your bundler dev server                   |
| `NxModuleFederationDevServerPlugin`                                                   | Not supported                                                       |
| `@nx/react:module-federation-static-server` and the Rspack equivalent                 | Not supported                                                       |
| `@nx/react/module-federation` and `@nx/rspack/module-federation` re-exports           | Same as the `@nx/module-federation` entry they re-export            |
| `sharePackages`, `shareWorkspaceLibraries`, `mapRemotes` from `@nx/module-federation` | Not supported. Write the resolved values out, Step 4                |

The two unsupported entries ran processes, not builds. `NxModuleFederationDevServerPlugin` is the
Rspack form of the dev-server executor, which started the host and every remote from one
`nx serve`. `@nx/react:module-federation-static-server` served the remotes you weren't working on
from a single port. Now you start the processes you want, and the runtime manifest from Step 5
lets the host boot without them.

Keep `NxAppRspackPlugin`, `NxAppWebpackPlugin`, `NxReactRspackPlugin`, and
`NxReactWebpackPlugin`. They are general bundler plugins and are not part of this removal.

> **The other route:** The `@nx/react:consumer` and `@nx/react:provider` generators create a new setup on Vite, Rsbuild,
> or Rspack, covered in [consumer and provider](https://nx.dev/docs/kb/consumer-and-provider). They generate
> new apps. Use them for a greenfield app or as a reference. For a workspace you already ship,
> update the configs in place with the steps below.

## Capture a baseline first

A remote can render correctly while the host and the remote hold separate copies of a shared
library. Write down what works now:

- Serve the host and its remotes, and visit the routes that load each remote.
- Edit a file in the host and in a remote. Both should refresh the app.
- Run a production build and note the artifacts you depend on, such as each remote's
  `remoteEntry.js`. Chunk names and order will change, so reproduce the federation config rather
  than the exact output.
- Copy each `dist/apps/<app>/mf-stats.json` out of `dist` before you rebuild. Steps 3 and 4
  reproduce its `shared` map, `exposes`, and container name.
- Note each app's `serve` port for the remote URLs in Step 5.

## Step 1: inventory the workspace

Search for every consumer before you edit one:

```shell
grep -rE "@nx/module-federation|@nx/react/module-federation|@nx/rspack/module-federation|@nx/react/mf|module-federation-dev-server|module-federation-static-server|ssr-dev-server|withModuleFederationForSSR|NxModuleFederationSSRDevServerPlugin|NX_MF_DEV_REMOTES" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --exclude-dir=node_modules --exclude-dir=.nx --exclude-dir=dist .
```

On Windows:

```powershell
Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.js,*.json |
  Where-Object FullName -notmatch 'node_modules|dist|\.nx' |
  Select-String -Pattern '@nx/module-federation|@nx/react/module-federation|@nx/rspack/module-federation|@nx/react/mf|module-federation-dev-server|module-federation-static-server|ssr-dev-server|withModuleFederationForSSR|NxModuleFederationSSRDevServerPlugin|NX_MF_DEV_REMOTES'
```

Record, per app, whether it exposes modules, consumes them, or does both, along with its
production remote URLs, custom upstream options, and any runtime plugins.

Apps with a `server` target or a `*.server.config.*` file are server-side rendered. Migrate their
browser build here, then their server build with
[migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-react-module-federation-ssr). Angular apps
follow [migrate Angular Module Federation](https://nx.dev/docs/kb/migrate-angular-module-federation) instead.

## Step 2: install the official packages

Workspaces created by the `host` generator already list `@module-federation/enhanced`. Application
code imports its runtime, so move it to `dependencies` if it sits in `devDependencies`, then
reinstall to update the lockfile. If it's missing, install it:

```shell
npm add --save-prod @module-federation/enhanced
```

Step 7 calls the bundler CLI. Rspack workspaces already declare `@rspack/cli`, but webpack
workspaces that only built through the Nx executor usually lack `webpack-cli`:

```shell
npm add -D webpack-cli
```

Use `pnpm add`, `yarn add`, or `bun add` in place of `npm add` throughout. On pnpm, pass `-P`
to move an existing devDependency to `dependencies`.

## Step 3: translate the federation config

Nx resolved each remote project name to a URL from the project graph. The official plugin needs
explicit values.

Rspack apps from the Nx 23 `host` and `remote` generators use a plain `rspack.config.ts` with
`NxModuleFederationPlugin` and `NxModuleFederationDevServerPlugin` on the inferred
`@nx/rspack/plugin` targets. Translate the `config` passed to `NxModuleFederationPlugin` and drop
the dev-server plugin. These apps have no build-target options to move in Step 6. Ignore the
generated `rspack.config.prod.ts`, which the inferred build never loads.

### Container name and import alias

The container name is normalized: every character outside `[a-zA-Z0-9_$]` becomes `_`, as does
a leading character that can't start an identifier, so `webpack-host` publishes as
`webpack_host`. Use that form for `name`.

The import alias stays the original project name. The key in `remotes` is the alias, and
`webpackRemoteA/Module` keeps working.

### Options Nx passed for you

Nx set `filename` to `remoteEntry.js`, set `remoteType` to `script` on webpack, and passed
through the `dts: false` override from your `withModuleFederation` call. Set all three yourself.
Without `dts: false`, every remote build logs a type-generation error.

Drop any `library` entry from the browser config. Nx never passed it to the plugin, and the
generated `{ type: 'var', name: '<project-name>' }` publishes an un-normalized global. On Rspack,
a `var` or `window` library type also turned on `remoteType: 'script'` and
`output.scriptType: 'text/javascript'`. Set both by hand if your Rspack config had one.

### Remote URLs

List only direct remotes. A remote that also consumes remotes keeps its `exposes` and gets a
`remotes` map too.

Generated apps also carry a `webpack.config.prod.*` file wired through
`build.configurations.production.webpackConfig`, holding tuples such as
`['webpackRemoteA', 'http://localhost:4701/']`. Nx appended `remoteEntry.js` to any tuple URL
without a filename, with or without a trailing slash. Fold both sets into one config keyed on
`NODE_ENV`, with exactly one slash before `remoteEntry.js`.

**Before:**

```ts
// apps/webpack-host/module-federation.config.ts
import type { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'webpack-host',
  remotes: ['webpackRemoteA', 'webpackRemoteB'],
};

export default config;
```

**After:**

```js
// apps/webpack-host/module-federation.config.js
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  name: 'webpack_host', // normalized
  filename: 'remoteEntry.js',
  dts: false,
  remoteType: 'script', // webpack only, Rspack defaults to script
  remotes: {
    webpackRemoteA: isProd
      ? 'webpackRemoteA@https://remote-a.example.com/remoteEntry.js'
      : 'webpackRemoteA@http://localhost:4701/remoteEntry.js',
    webpackRemoteB: isProd
      ? 'webpackRemoteB@https://remote-b.example.com/remoteEntry.js'
      : 'webpackRemoteB@http://localhost:4702/remoteEntry.js',
  },
  shared: {
    // ... see Step 4
  },
};
```

Remote configs keep their `exposes` map unchanged. A top-level host needs these URLs only until
Step 5 moves them to a runtime manifest. A remote that consumes other remotes keeps its map.

> **JavaScript config files:** The samples use CommonJS `.js`, which both CLIs load without a TypeScript loader. Recent Node
> versions run TypeScript configs directly, so you can rename them back to `.ts` once the migration
> works.

## Step 4: write the shared map

Nx built `shared` from the project graph. It covered framework packages, their secondary entry
points, every workspace library the app imports, and those libraries' npm dependencies. The
official plugin shares only what you list.

Copy the values from the baseline `mf-stats.json`, including `singleton`, `strictVersion`,
`requiredVersion`, and `eager` per entry:

```js
// apps/webpack-host/module-federation.config.js
module.exports = {
  // ... name, filename, dts, remotes
  shared: {
    '@myorg/state': {
      singleton: true,
      requiredVersion: false,
      version: '1.0.0',
    },
    react: {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^19.0.0',
      eager: true,
    },
    'react-dom': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^19.0.0',
      eager: true,
    },
    'react-dom/client': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^19.0.0',
    },
    'react/jsx-runtime': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^19.0.0',
    },
  },
};
```

Check these against the stats.

- **Secondary entry points are separate keys.** `pkg` does not cover `pkg/subpath`. List the
  subpaths the stats show.
- **`additionalShared` entries set their own values.** The same package can appear with a
  different range and no `strictVersion`, so copy each entry as it is and drop any the stats don't
  list.
- **The stats rewrite one field.** A callback that set `requiredVersion: false` shows up as
  `requiredVersion: '^<version>'`. For a workspace library, keep the `false` and your callback's
  `version`.
- **A source-only workspace library needs an explicit `version`.** `singleton: true` alone did not
  give host and remotes one copy in testing. Use the library's declared version or one your team
  agrees on, and never give two implementations the same version. A library with no
  `package.json` shows `0.0.0` in the stats. Copy that.

Nx found workspace libraries only through `tsconfig.base.json` paths. In a workspace linked
through package manager workspaces, it never shared them, and each app bundled its own copy. If a
library that several apps import is missing from the stats, sharing it now changes behavior. Give
it an explicit `version` and note the change.

> **Imports have to use the library's package name:** A `shared` key matches the request string. A library imported by a relative path into its
> source resolves to a separate copy. Nx rewrote those requests, and the official plugin does not.

Replace each call to `sharePackages`, `shareWorkspaceLibraries`, or `mapRemotes` with the values
it returned. The stats list them.

```js
// before: shared: sharePackages(['react', 'react-dom'])
// after:
const sharedNpm = (names, version) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      { singleton: true, strictVersion: true, requiredVersion: version },
    ])
  );

module.exports = {
  // ...
  shared: sharedNpm(['react', 'react-dom'], '^19.0.0'),
};
```

## Step 5: move remotes to a runtime manifest

A runtime manifest holds the remote URLs in a file the host fetches at startup. You can change
a URL without rebuilding, and the host boots even when a remote is down. It's the upstream
default, described in the [manifest reference](https://module-federation.io/configure/manifest),
and it replaces the static server this migration removes.

Register the remotes before the async boundary that imports your bootstrap, and translate
`loadRemoteModule(name, './Module')` into `loadRemote(name + '/Module')`.

**Before:**

```tsx
// apps/webpack-host/src/app/app.tsx
const RemoteA = React.lazy(() => import('webpackRemoteA/Module'));
```

**After:**

```ts
// apps/webpack-host/src/main.ts
import { registerRemotes } from '@module-federation/enhanced/runtime';

fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) =>
    registerRemotes(
      Object.entries(remotes).map(([name, entry]) => ({
        name,
        entry,
        type: 'global' as const,
      }))
    )
  )
  .then(() => import('./bootstrap'));
```

```tsx
// apps/webpack-host/src/app/app.tsx
import { loadRemote } from '@module-federation/enhanced/runtime';

const RemoteA = React.lazy(
  () =>
    loadRemote<{ default: React.ComponentType }>(
      'webpackRemoteA/Module'
    ) as Promise<{ default: React.ComponentType }>
);

// a module with a named export, such as one added by federate-module
const Greeting = React.lazy(() =>
  loadRemote<{ Greeting: React.ComponentType }>('webpackRemoteD/Greeting').then(
    (m) => ({ default: m!.Greeting })
  )
);
```

```json
// apps/webpack-host/src/assets/module-federation.manifest.json
{
  "webpackRemoteA": "http://localhost:4701/remoteEntry.js",
  "webpackRemoteB": "http://localhost:4702/remoteEntry.js"
}
```

- **Every value is a full entry URL.** `loadRemoteModule` appended `/remoteEntry.mjs` to a bare
  origin such as `http://localhost:4701`. `registerRemotes` uses the string as given. With
  `output.publicPath: 'auto'`, each remote's chunks load from wherever its entry came from. Put a
  deployment path prefix in the manifest you ship, not your local one.
- **Each key is the remote's normalized container name.** `type: 'global'` makes the runtime read
  the container from `globalThis[name]`, which matches how Nx built these remotes. The key must
  match `name` from Step 3, and it's also the prefix `loadRemote` takes. A project named
  `my-remote` is `my_remote` in the manifest and in `loadRemote('my_remote/Module')`.
- **The host loses its project-graph edge.** Static `import('<remote>/Module')` calls gave Nx
  that edge. Add `implicitDependencies` on the host so remotes still build first and
  `nx affected` still includes the host. In a package manager workspace, a `workspace:*`
  dependency on each remote gives the same edge. Drop the host's `<remote>/Module` entries from
  `tsconfig.base.json` and any `remotes.d.ts`.
- **Per-environment URLs move into the manifest.** The `NODE_ENV` ternary from Step 3 has no
  equivalent. Ship the right manifest for each environment, with a `fileReplacements` pair or by
  writing the file at deploy time.

Only a top-level host converts. A remote that consumes other remotes keeps its static `remotes`
map. Hosts load its exposed module, not its `main.ts`, and a registration there never runs.

> **Staying with static remotes:** Keep the `remotes` map from Step 3 and the `tsconfig.base.json` paths, and skip this step.
> Every remote then has to be running before the host boots, so serve them together:
> `nx run-many -t serve -p webpack-host webpackRemoteA webpackRemoteB`.

A host that already calls `init` or `registerRemotes` from the upstream runtime is done. That
includes the Nx 23 `--dynamic` host, which registers `mf-manifest.json` entries without a `type`.
The official plugin still emits `mf-manifest.json`. That host never had a graph edge to its
remotes. Add `implicitDependencies` for them.

A host that passes a fetched manifest to `setRemoteDefinitions` still needs the conversion above.
A host that used `setRemoteUrlResolver` from `@nx/react/mf` keeps its URL logic and passes each
resolved URL as the `entry` in `registerRemotes`.

## Step 6: swap the wrapper in the bundler config

`composePlugins(withNx(), withReact(), withModuleFederation(config))` returns an Nx-specific
config function that the Rspack and webpack CLIs can't run. Replace it with a standard config
object that adds `ModuleFederationPlugin`, then move `build` and `serve` to the CLI in Step 7.

The options on your old `build` target become `NxAppRspackPlugin` or `NxAppWebpackPlugin`
options. When you move them:

- Paths such as `main`, `index`, `tsConfig`, `assets`, and `styles` resolve from the project
  root. `apps/webpack-host/src/main.ts` becomes `./src/main.ts`.
- `fileReplacements` paths resolve from the workspace root. Drop a pair whose files do not exist.
- Values that differed per named configuration become
  `process.env.NODE_ENV === 'production'` ternaries. Step 7 sets `NODE_ENV` per configuration.
- Drop the generator's per-configuration `optimization`, `outputHashing`, `sourceMap`,
  `namedChunks`, and `vendorChunk` values. The plugin derives them from `NODE_ENV`. It doesn't
  derive `extractLicenses`, so keep that on for production only.
- Leave no build options on the target. The plugin merges in the running target's `project.json`
  options, and they win.

The wrapper also changed these bundler settings, which you now set yourself.

| Setting                     | Value                                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output.uniqueName`         | The project name, not the normalized container name                                                                                                                                                |
| `output.publicPath`         | `'auto'`                                                                                                                                                                                           |
| `output.clean`              | `true`. The Rspack app plugin defaults it, the webpack one does not, and without it a development build lands on top of production files                                                           |
| `output.scriptType`         | `'text/javascript'` on webpack                                                                                                                                                                     |
| `resolve.modules`           | `node_modules` plus the workspace root, as the wrapper set. `exposes` paths written from the workspace root need it                                                                                |
| `optimization.runtimeChunk` | `false` on remotes and host production builds. `'single'` on host development builds, or host edits never re-render. Set the app-plugin `runtimeChunk` to match. It overwrites the top-level value |
| `commonChunk`               | `false` in the app-plugin options. `NxAppWebpackPlugin` defaults it to `true` and adds a `common.<hash>.js` per remote                                                                             |
| `splitChunks.cacheGroups`   | `default` and `common` set to `false`, only if the old config used `NxModuleFederationPlugin`. `withModuleFederation` did not set them                                                             |
| `lazyCompilation` (Rspack)  | `false`. rspack-cli turns it on in dev mode, and federation breaks                                                                                                                                 |
| `devServer.hot`             | `true` on every app, remotes included. Remote edits then update the host without resetting its state                                                                                               |
| `devServer.headers`         | `Access-Control-Allow-Origin`, so a host on one port can fetch `remoteEntry.js` from another                                                                                                       |

**Rspack:**

```js
// apps/rspack-host/rspack.config.js
const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
const {
  ModuleFederationPlugin,
} = require('@module-federation/enhanced/rspack');
const { join } = require('node:path');
const mf = require('./module-federation.config');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  lazyCompilation: false,
  output: {
    path: join(__dirname, '../../dist/apps/rspack-host'),
    publicPath: 'auto',
    uniqueName: 'rspack-host',
    clean: true,
  },
  resolve: { modules: ['node_modules', join(__dirname, '../..')] },
  optimization: {
    runtimeChunk: isProd ? false : 'single', // host only, remotes use false
    // only if the old config used NxModuleFederationPlugin
    splitChunks: { cacheGroups: { default: false, common: false } },
  },
  devServer: {
    port: 4703,
    hot: true,
    static: false,
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: { index: '/index.html', disableDotRule: true },
  },
  plugins: [
    new NxAppRspackPlugin({
      // ... your existing options, minus outputPath
      runtimeChunk: !isProd, // host only, remotes use false
      commonChunk: false,
      extractLicenses: isProd,
    }),
    new NxReactRspackPlugin(),
    new ModuleFederationPlugin(mf),
  ],
};
```

**webpack:**

```js
// apps/webpack-host/webpack.config.js
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const {
  ModuleFederationPlugin,
} = require('@module-federation/enhanced/webpack');
const { join } = require('node:path');
const mf = require('./module-federation.config');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/webpack-host'),
    publicPath: 'auto',
    uniqueName: 'webpack-host',
    scriptType: 'text/javascript',
    clean: true,
  },
  resolve: { modules: ['node_modules', join(__dirname, '../..')] },
  optimization: { runtimeChunk: isProd ? false : 'single' }, // host only, remotes use false
  devServer: {
    port: 4700,
    hot: true,
    static: false,
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: { index: '/index.html', disableDotRule: true },
  },
  plugins: [
    new NxAppWebpackPlugin({
      // ... your existing options, minus outputPath
      runtimeChunk: !isProd, // host only, remotes use false
      commonChunk: false,
      extractLicenses: isProd,
    }),
    new NxReactWebpackPlugin(),
    new ModuleFederationPlugin(mf),
  ],
};
```

> **These configs still run through Nx:** The app plugins read `NX_TASK_TARGET_PROJECT` and related variables to find the project. The
> config works under `nx run` and fails under a bare `npx webpack serve` from the app folder.

The Nx dev server also derived `devMiddleware.publicPath` from `baseHref`, mapped `publicHost` to
`client.webSocketURL`, and passed through `proxyConfig`, `allowedHosts`, and the `ssl` options.
If you served under a sub-path, behind a proxy, or over HTTPS, add those to `devServer` yourself.

Delete the replaced files in this same step: `module-federation.config.ts`, `rspack.config.ts` or
`webpack.config.ts`, and any `*.config.prod.*`. While the old `.ts` config exists, an inferred
build still loads it, and its `./module-federation.config` import now picks up your new `.js`
file.

## Step 7: update the targets

The official plugin only covers the build. The host's `serve` no longer starts its remotes, so
you start the ones you need.

Point `build` and `serve` at the bundler CLI, with `NODE_ENV` in place of the named
configurations the executor passed:

```jsonc
// apps/rspack-host/project.json
{
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{workspaceRoot}/dist/apps/rspack-host"],
      "defaultConfiguration": "production",
      "options": {
        "command": "rspack build --config rspack.config.js",
        "cwd": "apps/rspack-host",
      },
      "configurations": {
        "production": { "env": { "NODE_ENV": "production" } },
        "development": { "env": { "NODE_ENV": "development" } },
      },
    },
    "serve": {
      "executor": "nx:run-commands",
      "continuous": true,
      "defaultConfiguration": "development",
      "readyWhen": { "signal": true },
      "options": {
        "command": "rspack serve --config rspack.config.js",
        "cwd": "apps/rspack-host",
      },
      "configurations": {
        "development": { "env": { "NODE_ENV": "development" } },
        "production": { "env": { "NODE_ENV": "production" } },
      },
    },
    "serve-static": {
      "executor": "@nx/web:file-server",
      "continuous": true,
      "dependsOn": ["build"],
      "readyWhen": { "signal": true },
      "options": {
        "staticFilePath": "dist/apps/rspack-host",
        "port": 4703,
        "spa": true,
        "watch": false,
      },
    },
  },
}
```

On webpack, the commands are `webpack build --config webpack.config.js` and
`webpack serve --config webpack.config.js`.

With `readyWhen: { "signal": true }`, the server reports to Nx when it listens.
`NxAppRspackPlugin` and `NxAppWebpackPlugin` send that report from the dev server, and
`@nx/web:file-server` sends it once the static server accepts connections. A task waits for it
only through a `dependsOn` entry with `"waitFor": "ready"`, as the e2e setup below does.

With a runtime manifest from Step 5, serve the host alone and add remotes as you need them, live
or from their last build:

```shell
nx serve rspack-host
nx run-many -t serve-static -p rspackRemoteA rspackRemoteB
```

`nx serve rspack-host --devRemotes=rspackRemoteA` becomes one command for the apps you edit and
one for the rest:

```shell
nx run-many -t serve -p rspackRemoteA rspack-host
nx run-many -t serve-static -p rspackRemoteB
```

When the host runs in development, build the remotes you serve statically with the development
configuration too, or serve them live. A development host with production-built remotes can render
a blank page.

```shell
nx run-many -t build -p rspackRemoteB -c development
nx run-many -t serve-static -p rspackRemoteB --excludeTaskDependencies
```

The blank page shows `dispatcher.getOwner is not a function`. The runtime picked the remote's
production `react` while the host's `react/jsx-dev-runtime` stayed development.
`shareStrategy: 'loaded-first'` avoids it but stops remote edits from updating the host. Do not
use it.

> **Inferred targets:** If `nx.json` lists `@nx/rspack/plugin` or `@nx/webpack/plugin`, the inferred `build` and `serve`
> targets work as they are. Only `serve-static` needs the shape above. Nx merges your `project.json`
> options over the inferred ones key by key, and the inferred `buildTarget` comes along with your
> `staticFilePath`. Add `"buildTarget": ""` to clear it.

Leave `buildTarget` unset on `serve-static`. With it set, the file server rebuilds the app and
duplicates the `dependsOn` build, which fails inside an e2e run. Keep `spa: true` on every app, or
a refresh on a deep route returns a 404.

An e2e run needs the host and every remote it loads. Run each app's `serve-static` as a task the
e2e task depends on with `"waitFor": "ready"`, so the tests start once every app is ready. Do not
start the apps with `nx run-many` from a web server command or a `run-commands` target. Nx then
cannot wait for each app.

For Playwright, list one `webServer` entry per app, each with `reuseExistingServer: true`.
`@nx/playwright/plugin` turns each `npx nx run <app>:serve-static` command into a dependency of
the e2e tasks, atomized `e2e-ci` tasks included, and waits until every app is ready. It infers
nothing for an entry without `reuseExistingServer: true`. Keep `baseURL` on the host's
`serve-static` port.

```ts
// apps/webpack-host-e2e/playwright.config.ts
export default defineConfig({
  // ... preset, use, and projects as before
  webServer: [
    {
      command: 'npx nx run webpack-host:serve-static',
      url: 'http://localhost:4700',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    {
      command: 'npx nx run webpackRemoteA:serve-static',
      url: 'http://localhost:4701',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    {
      command: 'npx nx run webpackRemoteB:serve-static',
      url: 'http://localhost:4702',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
  ],
});
```

Nx v24 removed the `@nx/cypress:cypress` executor. If a Cypress e2e target still uses it,
convert the project first with `nx g @nx/cypress:convert-to-inferred --project=webpack-host-e2e`.
The generator moves `devServerTarget` into `webServerCommands` in `cypress.config.ts`.

`@nx/cypress/plugin` infers the e2e task's dependency from `webServerCommands.default`, which
names one task. Point every `webServerCommands` entry at the host's `serve-static`, and keep
`baseUrl` on its port:

```ts
// apps/webpack-host-e2e/cypress.config.ts
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      webServerCommands: { default: 'npx nx run webpack-host:serve-static' },
    }),
    baseUrl: 'http://localhost:4700',
  },
});
```

Then replace the inferred dependency with one on every app in the e2e project's `project.json`:

```jsonc
// apps/webpack-host-e2e/project.json
{
  "targets": {
    "e2e": {
      "dependsOn": [
        {
          "projects": ["webpack-host", "webpackRemoteA", "webpackRemoteB"],
          "target": "serve-static",
          "waitFor": "ready",
        },
      ],
    },
  },
}
```

A `ciWebServerCommand` gives the atomized `e2e-ci--<spec>` tasks the same single dependency. Point
it at the host's `serve-static` too, and give those tasks the full dependency through a
`targetDefaults` entry keyed on their names and filtered to the e2e project:

```jsonc
// nx.json
{
  "targetDefaults": {
    "e2e-ci--**/**": [
      {
        "filter": { "projects": ["webpack-host-e2e"] },
        "dependsOn": [
          {
            "projects": ["webpack-host", "webpackRemoteA", "webpackRemoteB"],
            "target": "serve-static",
            "waitFor": "ready",
          },
        ],
      },
    ],
  },
}
```

Last, remove the `targetDefaults` entries in `nx.json` keyed on `@nx/rspack:rspack` or
`@nx/webpack:webpack`. Their `NX_MF_DEV_REMOTES` input no longer does anything. Move their other
settings, such as `cache`, `inputs`, and `dependsOn`, to the generic `build` default. A `filter`
scopes them to a set of projects:

```jsonc
// nx.json
{
  "targetDefaults": {
    "build": [
      {
        "filter": { "projects": ["apps/*", "!apps/legacy"] },
        "cache": true,
        "inputs": ["production", "^production"],
      },
    ],
  },
}
```

See the [task pipeline reference](https://nx.dev/docs/reference/nx-json#task-pipelines) for the full syntax.

## Step 8: validate the result

A green build isn't enough. Everything you recorded in the baseline has to work again, along
with these checks.

- Production and development configurations both build with `--skipNxCache`. Build production
  last, since both write the same `mf-stats.json`.
- `tsc -p apps/<app>/tsconfig.app.json --noEmit` passes for each app. The app plugin type-checks
  asynchronously, and a build exits 0 on type errors.
- Each app's production `mf-stats.json` lists the same container name, exposes, and `shared`
  entries as the baseline. A host on a runtime manifest has an empty build-time `remotes` by
  design. Check its manifest against the baseline URLs.
- The e2e suite passes against the replacement web server.
- With only `nx serve webpackRemoteA` running, the host boots and the `webpackRemoteA` route
  renders.
- In development, with at least one remote served statically, an edit to a host file and an edit
  to a live remote both update the page without a reload.

Record baseline failures separately instead of weakening an assertion to get a pass.

## Step 9: remove the package

Once nothing references the removed APIs and the new setup builds and runs, remove the package:

```shell
npm remove @nx/module-federation
```

Keep `@module-federation/enhanced` as a direct dependency and commit the lockfile.

## What the official plugins do not do

- **`--devRemotes` selection.** The targets you start decide which remotes run live and which
  serve from a build.
- **Runtime library control.** `withModuleFederation` attached a runtime plugin when the
  dev-server executor set `NX_MF_DEV_REMOTES`. It let a live remote's copy of a shared library win
  over a static one. Nothing sets that variable now.
- **Automatic remote fallback.** A host fails the request when a remote is unavailable. Add your
  own error boundary if you need one.

For anything beyond this migration, such as runtime plugins, promise-based remotes, or
cross-version deployments, use the official
[configuration reference](https://module-federation.io/configure/) and
[runtime documentation](https://module-federation.io/guide/basic/runtime).

# Migrate server-side rendered React Module Federation apps

## Rules

Migrate the server build of each server-side rendered React Module Federation app in this workspace off the Nx Module Federation APIs that Nx v24 removes. An app with a `server` target or a `*.server.config.*` file is server-side rendered. Migrate its browser build first with https://nx.dev/docs/kb/migrate-from-nx-module-federation, then follow every step at https://nx.dev/docs/kb/migrate-react-module-federation-ssr.

Rules that override any shortcut you are tempted to take:

1. Before editing, keep the baseline browser stats from `dist/apps/<app>/browser/mf-stats.json`. Record the server-rendered HTML of each host route that renders a remote.
2. Replace `withModuleFederationForSSR` with `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` or `/rspack`, and drop `NxModuleFederationSSRDevServerPlugin`. Keep `@module-federation/node` as a dependency.
3. The server container sets `library: { type: 'commonjs-module' }`, `remoteType: 'script'` on both bundlers, `experiments: { asyncStartup: true }`, and `runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')]`. Its remote URLs keep the `name@` prefix and point at `<origin>/server/remoteEntry.js`.
4. Server builds write no stats. Reuse the browser `shared` map, with every entry `eager: true` on Rspack.
5. A host on a runtime manifest also calls `registerRemotes` in `server.ts` with the `/server` URLs. On webpack keep `@module-federation/*` inside the server bundle, or the server fails with `#RUNTIME-009`.
6. Replace the SSR dev server with watch builds plus `node --watch-path`. A static run is `node dist/apps/<app>/server/server.js`, never `@nx/web:file-server`. On Rspack, run it from `apps/<app>` (`node ../../dist/apps/<app>/server/server.js`), since the generated `server.ts` resolves `dist` from the working directory.
7. Accept the migration only when each host route's HTML holds the remote's markup and client scripts, and the page hydrates in a browser without errors. Report what you verified and what you did not.

> **Migrate the browser build first:** This guide covers only the server build. Finish
> [migrating the browser build](https://nx.dev/docs/kb/migrate-from-nx-module-federation) of every app, then
> come back here.

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

**Rspack:**

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

**webpack:**

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

**Rspack:**

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

**webpack:**

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

# Migrate Angular apps off Nx Module Federation

## Rules

Migrate this Angular workspace off the Nx Module Federation APIs that Nx v24 removes. Follow every step at https://nx.dev/docs/kb/migrate-angular-module-federation in order. Default to Path A (keep the current bundler, use the official plugin). Take Path B (Native Federation) only when the user asks for it.

Rules 2 to 7 cover Path A. On Path B, follow that section of the page instead:

1. Before editing, run production builds and keep every `mf-stats.json` (`dist/apps/<app>/mf-stats.json` on webpack, `dist/apps/<app>/browser/mf-stats.json` on Rspack). Reproduce its `shared` array, `exposes`, and container name. If a generated Rspack app fails its initial `maximumError` budget, raise it. If webpack 5.111 or later fails with `Path variable [contenthash:20] not implemented`, pin webpack to 5.110 or earlier.
2. Replace `withModuleFederation` and `NxModuleFederationPlugin` from `@nx/module-federation/angular` with `ModuleFederationPlugin` from `@module-federation/enhanced/webpack` or `/rspack`, and drop `NxModuleFederationDevServerPlugin`. Keep `@nx/angular:webpack-browser` with `customWebpackConfig` on webpack, and `createConfig` from `@nx/angular-rspack` on Rspack.
3. Browser containers are ES modules: set `library: { type: 'module' }`, `experiments.outputModule: true` on webpack or `output.module: true` on Rspack, `filename: 'remoteEntry.mjs'` on webpack and `remoteEntry.js` on Rspack, `dts: false`, `output.publicPath: 'auto'`, `output.uniqueName`, and `optimization.runtimeChunk: false`. An Rspack host keeps its runtime chunk under the dev server. Write `remotes` as plain URLs with no `name@` prefix, one entry per remote even when the host stats list it once per exposed module.
4. On webpack, add `resolve.alias` entries for every workspace library referenced through `tsconfig` paths. Never alias a `<remote>/<exposed>` entry such as `remoteA/Routes`, `remoteNg/Module`, or a `federate-module` path. Rspack's `createConfig` reads the paths itself and needs no alias.
5. Move every host to a runtime manifest so it boots without every remote running. A host that already calls `registerRemotes` from `@module-federation/enhanced/runtime` is done, including `mf-manifest.json` entries with no `type`. For static hosts and hosts on `@nx/angular/mf`, fetch `module-federation.manifest.json` in `main.ts` and pass it to `registerRemotes` with `type: 'module'`, set `remotes: {}` in the federation config, replace `import('<remote>/Routes')` and `loadRemoteModule(name, './Routes')` with `loadRemote('<container-name>/Routes')`, add `implicitDependencies` on the host, and drop the `<remote>/<exposed>` paths from `tsconfig.base.json`. Map keys and `loadRemote` prefixes are the normalized container name. Map values must be full `remoteEntry.mjs` URLs (`remoteEntry.js` on Rspack). Keep static `remotes` only if the user asks to stay static.
6. On webpack, replace the `serve` target with `@nx/angular:dev-server` and set `readyWhen: { signal: true }` on every app's `serve` target. On Rspack keep the inferred targets. Keep each remote's `dependsOn: ['<host>:serve']`, set `headers: { 'Access-Control-Allow-Origin': '*' }` on every remote's serve target (on Rspack under `devServer.headers` in `rspack.config.ts`), and add a `serve-static` target per app using `@nx/web:file-server` with `staticFilePath`, `dependsOn: ['build']`, `spa: true`, `watch: false`, `readyWhen: { signal: true }`, never `buildTarget`. Make each e2e task wait for every app's `serve-static`. On Playwright, list one `webServer` entry per app running `npx nx run <app>:serve-static`, with its `url` and `reuseExistingServer: true`. On Cypress, point `webServerCommands` and `ciWebServerCommand` at `npx nx run <host>:serve-static`, and give the e2e target `dependsOn: [{ projects: [<host>, <remotes>], target: 'serve-static', waitFor: 'ready' }]`. Give the atomized `e2e-ci--*` tasks the same `dependsOn` through a `targetDefaults` entry filtered to the e2e project. Never start the apps with `nx run-many` from an e2e web server command.
7. Remove `@nx/module-federation` only after the new setup builds and runs. Move `@module-federation/enhanced` to `dependencies` (`pnpm add -P` on pnpm). Rebuild uncached, production last. On Rspack a development build needs `NGRS_CONFIG=development`, or it exits 0 with production output. After removing the package, rename any copy left in `node_modules` (pnpm keeps one under `.pnpm/` for optional peers) for one uncached build, then put it back.
8. Serve one remote alone with `nx serve <remote>`, and check that the host boots and that remote's route renders. Do not claim hot-update parity or shared-state parity from a green build. Remote edits reach the host after a reload, before and after this migration. On Rspack the first load after the dev server starts can need one reload. `Cannot find module '<id>'` while loading `./Routes` means a stale cache: run `nx reset`, delete `.angular/cache`, and rebuild. Report what you verified and what you did not.
9. On Path B, install the `@angular-architects/native-federation` release matching the workspace's Angular major and minor. A host calling `loadRemote('remoteA/Routes')` switches to `loadRemoteModule('remoteA', './Routes')`.
10. For apps with a server build (a `server` target or a `webpack.server.config.*` file), follow https://nx.dev/docs/kb/migrate-angular-module-federation-ssr after Path A. Path B does not cover server-side rendering. Stop and report if the user asks for Path B on one.

Nx v23 deprecates the Angular Module Federation generators, executors, runtime helpers, and the
`withModuleFederation` and `NxModuleFederationPlugin` wrappers in `@nx/module-federation/angular`.
These APIs wrap the official [Module Federation](https://module-federation.io) plugin, which
supports both webpack and Rspack. Nx v24 removes the wrappers, so migrate your apps to the official
plugin directly.

Migrate before you upgrade to v24. The old packages still build, which gives you a baseline to
compare against. Nx will also ship migrations for this later.

You have one decision to make before you start:

- **Path A** keeps your bundler and swaps the wrapper for the official plugin. Your build target
  and deployment model stay the same, and hosts load remotes from a runtime manifest. It is the
  conservative option and the smallest diff.
- **Path B** moves to [Native Federation](https://www.npmjs.com/package/@angular-architects/native-federation)
  and onto the esbuild-based `@angular/build:application` builder. It is the larger change, and
  the one more likely to track Angular's own direction.

> **Scope:** Static and runtime-loaded remotes. For server-side rendered (`--ssr`) apps, follow Path A, then
> [migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-angular-module-federation-ssr). Path B does
> not cover them. For React, see the
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
- Note each app's `serve` port for the remote URLs in Step 3.

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

Sort your hosts into two groups by reading each `src/main.ts`. Step 5 moves both to a runtime
manifest.

- **Static hosts** have no federation call in `main.ts`. They reach remotes through an
  `import('remoteA/Routes')` in the routes file, resolved by a `tsconfig.base.json` path. Step 5
  converts them.
- **Runtime-loaded hosts** fetch a manifest in `main.ts`. If that chain ends in `init` or
  `registerRemotes` from `@module-federation/enhanced/runtime`, the host needs no source change
  on Path A. Nx 23.2 generates `--dynamic` hosts this way. If it ends in `setRemoteDefinitions`
  from `@nx/angular/mf`, Step 5 converts it.

Server-side rendered apps (a `server` target or a `webpack.server.config.ts`) follow Path A, then
[migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-angular-module-federation-ssr). Their server
build fails in between.

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

Every app needs its own map, copied from that app's baseline `mf-stats.json`. Nx shared every npm
package the app depends on in the graph, plus each package's secondary entry points, so expect
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

`eager: false` is the plugin default and can be left out, but Rspack stats mark most
`@angular/*` entries `eager: true` and those need copying.

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

Every app's config carries `name`, `filename`, `library`, and `dts`, and hosts add `remotes`.
Remotes keep their existing `exposes` map, whose workspace-root paths resolve once Step 4 adds the
workspace root to `resolve.modules`.

Production remote URLs live in `webpack.prod.config.ts` as
`['remoteA', 'http://remote-a.example.com/']` tuples. On webpack the `production` configuration
loads that file through `customWebpackConfig`. Rspack never loads it. Fold those URLs into the one
config, adding the `/remoteEntry.mjs` that Nx appended for you. If the file only has the
generator's commented example, you have one URL set for every configuration.

Key the URLs on the Nx task configuration, because the Angular builders don't set `NODE_ENV`.

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

Rspack containers keep `filename: 'remoteEntry.js'`, so host `remotes` URLs end in
`/remoteEntry.js` rather than `.mjs`. Skip `resolve.alias`, since `createConfig` reads `tsconfig`
paths itself.

> **Do not add \:** Rspack builds print a `MODULE_TYPELESS_PACKAGE_JSON` warning that predates this migration. Leave
> it alone, because adding `"type": "module"` breaks the CommonJS federation config.

### Step 5: move hosts to a runtime manifest

A runtime manifest holds the remote URLs in a file the host fetches at startup. A static host loads
every remote's entry before it renders, so one remote that isn't running leaves a blank page. With
a manifest the host boots on its own, and only the routes of stopped remotes fail. You can also
change a URL without rebuilding.

Hosts that already call `registerRemotes` or `init` from `@module-federation/enhanced/runtime`
skip this step, including the Nx 23.2 `--dynamic` host. Convert static hosts and hosts that call
`setRemoteDefinitions` from `@nx/angular/mf`.

Move the `remotes` URLs from Step 3 into `public/module-federation.manifest.json`. The host keeps
`ModuleFederationPlugin` in its build with `remotes: {}`, since `registerRemotes` and
`loadRemote` do nothing without the runtime it creates.

**Static host:**

```ts
// apps/shell/src/app/app.routes.ts
export const appRoutes: Route[] = [
  {
    path: 'remoteA',
    loadChildren: () => import('remoteA/Routes').then((m) => m!.remoteRoutes),
  },
];
```

**Runtime-loaded host:**

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
// apps/shell/src/main.ts
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
// apps/shell/src/app/app.routes.ts
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appRoutes: Route[] = [
  {
    path: 'remoteA',
    loadChildren: () =>
      loadRemote<{ remoteRoutes: Route[] }>('remoteA/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
];
```

```json
// apps/shell/public/module-federation.manifest.json
{
  "remoteA": "http://localhost:4201/remoteEntry.mjs",
  "remoteB": "http://localhost:4202/remoteEntry.mjs"
}
```

Map values must be full URLs. Append `/remoteEntry.mjs` (`/remoteEntry.js` on Rspack) to any
bare origin, which `setRemoteDefinitions` used to complete for you. A remote's `mf-manifest.json`
URL works too. Register `remoteEntry.mjs` values with `type: 'module'`, while manifest values
carry their own type.

Map keys and `loadRemote` prefixes use the normalized container name. A project named `remote-a`
is `remote_a` in the manifest and `loadRemote('remote_a/Routes')` at the call site.

A static host loses its project-graph edge, which its `import('remoteA/Routes')` calls gave Nx.
Add `implicitDependencies` on the host so remotes still build first and `nx affected` still
includes the host. Drop the host's `<remote>/<exposed>` paths from `tsconfig.base.json`.

The `isProd` ternary from Step 3 has no equivalent in the manifest. Ship the right manifest for
each environment, with a `fileReplacements` pair or by writing the file at deploy time.

> **Staying with static remotes:** Keep the `remotes` map from Step 3 and the `tsconfig.base.json` paths, and skip this step.
> Every remote then has to be running before the host renders, so serve them together:
> `nx run-many -t serve -p shell remoteA remoteB`.

### Step 6: replace the serve orchestration

`@nx/angular:module-federation-dev-server` built and served the remotes along with the host, and
`--devRemotes` picked which ones ran live. The official plugin only handles the build, so you
start the processes yourself.

#### Dev servers

On webpack, switch the host's `serve` executor to `@nx/angular:dev-server`. Keep `port`,
`publicHost`, and the per-configuration `buildTarget` options. Remove `devRemotes`,
`skipRemotes`, `static`, `isInitialHost`, and `pathToManifestFile`, which the dev server rejects.
Set `readyWhen: { signal: true }` on every app's `serve` target, so the dev server reports to Nx
when it listens. On Rspack, keep the inferred `build` and `serve` targets.

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
      "readyWhen": { "signal": true },
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

Replace the whole target, including `configurations` and `defaultConfiguration`, and leave
`buildTarget` unset. With it set, the file server rebuilds the app on top of the `dependsOn`
build, and that nested build fails inside e2e runs. Keep `spa: true` so a refresh on a deep route
doesn't 404.

With `readyWhen: { "signal": true }`, the file server reports to Nx once it accepts
connections. A task waits for it only through a `dependsOn` entry with `"waitFor": "ready"`, as
the e2e setup below does.

Each remote's `serve-static` port must match the port in the host's `remotes` URL.

> **Inferred targets on Rspack:** On Rspack, `@nx/rspack/plugin` infers these targets and Nx merges your `project.json` options
> into them key by key. Add `"buildTarget": ""` to clear the inferred one.

#### End-to-end projects

Generated e2e projects start the host with `nx run shell:serve`, which no longer starts the
remotes. Run each app's `serve-static` as a task the e2e task depends on with
`"waitFor": "ready"`, so the tests start once every app is ready. Do not start the apps with
`nx run-many` from a web server command. Nx then cannot wait for each app. A remote's own e2e
project needs only that remote, with its URL and base URL on its `serve-static` port.

For Playwright, list one `webServer` entry per app, each with `reuseExistingServer: true`.
`@nx/playwright/plugin` turns each `npx nx run <app>:serve-static` command into a dependency of
the e2e tasks, atomized `e2e-ci` tasks included, and waits until every app is ready. It infers
nothing for an entry without `reuseExistingServer: true`. Keep `baseURL` on the host's
`serve-static` port.

```ts
// apps/shell-e2e/playwright.config.ts
export default defineConfig({
  // ... preset, use, and projects as before
  webServer: [
    {
      command: 'npx nx run shell:serve-static',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    {
      command: 'npx nx run remoteA:serve-static',
      url: 'http://localhost:4201',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    {
      command: 'npx nx run remoteB:serve-static',
      url: 'http://localhost:4202',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
  ],
});
```

Nx v24 removed the `@nx/cypress:cypress` executor. If a Cypress e2e target still uses it,
convert the project first with `nx g @nx/cypress:convert-to-inferred --project=shell-e2e`.

`@nx/cypress/plugin` infers the e2e task's dependency from `webServerCommands.default`, which
names one task. Point every `webServerCommands` entry and `ciWebServerCommand` at the host's
`serve-static`, and keep `baseUrl` on its port:

```ts
// apps/shell-e2e/cypress.config.ts
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      webServerCommands: { default: 'npx nx run shell:serve-static' },
      ciWebServerCommand: 'npx nx run shell:serve-static',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
```

Then replace the inferred dependency with one on every app. The e2e target takes it in the e2e
project's `project.json`. The atomized `e2e-ci--<spec>` tasks take it from a `targetDefaults`
entry keyed on their names and filtered to the e2e project:

```jsonc
// apps/shell-e2e/project.json
{
  "targets": {
    "e2e": {
      "dependsOn": [
        {
          "projects": ["shell", "remoteA", "remoteB"],
          "target": "serve-static",
          "waitFor": "ready",
        },
      ],
    },
  },
}
```

```jsonc
// nx.json
{
  "targetDefaults": {
    "e2e-ci--**/**": [
      {
        "filter": { "projects": ["shell-e2e"] },
        "dependsOn": [
          {
            "projects": ["shell", "remoteA", "remoteB"],
            "target": "serve-static",
            "waitFor": "ready",
          },
        ],
      },
    ],
  },
}
```

#### Target defaults

In `nx.json`, drop the `{ "env": "NX_MF_DEV_REMOTES" }` input from the
`@nx/angular:webpack-browser` target default and keep the rest of the entry.

### Step 7: validate the result

Check the result in a browser against your baseline:

- Each remote route renders in the host.
- With only `nx serve remoteA` running, which starts the host through `dependsOn`, the host
  boots and the `remoteA` route renders.
- A shared mutable value written in the host reads back in each remote after a client-side route
  change.
- Editing a remote's component shows in the host after a reload, as in the baseline.
- The e2e suite passes on the replacement web server.

Then check the builds:

- Production and development both build with `--skipNxCache` after you delete `dist/apps/<app>`
  and `.angular/cache`. Build production last because both configurations write the same
  `mf-stats.json`. On Rspack, build development as
  `NGRS_CONFIG=development nx build <app> --configuration=development`.
- Each app's production `mf-stats.json` lists the same container name, exposes, and `shared`
  entries as the baseline. Compare only those fields, since asset hashes and `usedIn` text
  change. A host on a runtime manifest has an empty build-time `remotes`, so check its manifest
  against the baseline URLs.

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
esbuild `@angular/build:application` builder. Expect to rewrite the federation layer, starting
from an `init` generator that expects an Angular CLI app.

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
- Mark the wrapped `serve` `continuous: true`. It has no configurations, so use `serve-static`
  for a production-like local run. Give the wrapped `build` `cache: true` and `outputs`
  (`{workspaceRoot}/dist/apps/<app>`). Cache hits start from the second build.
- Move the `dependsOn: ['shell:serve']` the generator renamed onto `serve-original` back to the
  new `serve`. When a second host uses the same remotes, name every app in the `run-many`.
- Replace each app's whole `serve-static` target, `defaultConfiguration` included, with the one
  from Path A Step 6 using `staticFilePath: dist/apps/<app>/browser`, and set up the e2e
  projects as in that step.
- Remove the `@nx/angular:webpack-browser` entry from `targetDefaults` in `nx.json` once every
  app has moved.
- Rewrite host routes to use Native Federation's `loadRemoteModule`. Static hosts replace each
  `import('remoteA/Routes')` with the call below, and so do hosts calling
  `loadRemote('remoteA/Routes')`. Hosts on `@nx/angular/mf` swap only the import:

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

# Migrate server-side rendered Angular Module Federation apps

## Rules

Migrate the server build of each server-side rendered Angular Module Federation app in this workspace off the Nx Module Federation APIs that Nx v24 removes. An app with a `server` target or a `webpack.server.config.*` file is server-side rendered. Complete Path A of https://nx.dev/docs/kb/migrate-angular-module-federation for the browser build first, then follow every step at https://nx.dev/docs/kb/migrate-angular-module-federation-ssr. Native Federation is not covered, so stop and report if the user asks for it on a server-side rendered app.

Rules that override any shortcut you are tempted to take:

1. Before editing, keep the baseline stats from `dist/apps/<app>/browser/mf-stats.json` and `dist/apps/<app>/server/mf-stats.json`. Record the server-rendered HTML of each host route that renders a remote.
2. Replace `withModuleFederationForSSR` from `@nx/module-federation/angular` with `ModuleFederationPlugin` from `@module-federation/enhanced/webpack`. Keep `@module-federation/node` as a dependency.
3. The server container sets `library: { type: 'commonjs-module' }`, `remoteType: 'script'`, `experiments: { asyncStartup: true }`, and `runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')]`. Its remote URLs keep the `name@` prefix and point at `<origin>/server/remoteEntry.js`, even though the browser container is `.mjs`.
4. Copy the server `shared` map from the server stats.
5. The server build fails after Path A until the server configs are replaced, because the old `webpack.server.config.ts` imports the new browser `module-federation.config.js`. Only validate the server build at the end.
6. Swap `@nx/angular:module-federation-dev-ssr` for `@angular-devkit/build-angular:ssr-dev-server` with an explicit `port`. A static run is `node dist/apps/<app>/server/main.js`, never `@nx/web:file-server`.
7. Accept the migration only when each host route's HTML holds the remote's markup and client scripts, and the page hydrates in a browser without errors. Report what you verified and what you did not.

> **Migrate the browser build first:** This guide covers only the server build. Complete Path A of
> [migrating Angular Module Federation](https://nx.dev/docs/kb/migrate-angular-module-federation) for every app,
> then come back here.

A host or remote generated with `--ssr` builds the same container twice, once for the browser and
once for Node. The server build needs its own container format, runtime plugin, and serve targets.
Native Federation server-side rendering is not covered.

## What replaces what

| Going away in v24                                                 | Replacement                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `withModuleFederationForSSR` from `@nx/module-federation/angular` | `ModuleFederationPlugin` with the `@module-federation/node` runtime |
| `@nx/angular:module-federation-dev-ssr`                           | `@angular-devkit/build-angular:ssr-dev-server`                      |

## Capture the server baseline

With `--ssr`, copy the browser stats from `dist/apps/<app>/browser/mf-stats.json` and the server
stats from `dist/apps/<app>/server/mf-stats.json`.

Also save the HTML each host route returns with `curl` to compare against at the end.

## Server container settings

The server container is CommonJS and loads remotes over HTTP through the Node runtime plugin.
Each remote's Express server serves its server build under `/server`, and the host's server-side
remote URLs point there. Keep that static mount in every remote's `server.ts`.

A host or remote generated with `--ssr` has a `server` target on `@nx/angular:webpack-server`
whose `webpack.server.config.ts` calls `withModuleFederationForSSR`. That config imports the
browser federation config, so the server build fails after Path A until you finish the steps
below.

## Server federation config

Write a `module-federation.server.config.js` per app. It keeps the browser config's `name`,
`exposes`, and `dts: false`. Unlike the browser container, it is CommonJS and its remote URLs
keep the `name@` prefix and end in `.js`:

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

## Server bundler config

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
`webpack.server.config.ts`.

## Targets

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

## What the official plugin does not do

- **Dev orchestration.** The SSR dev-server executor started the remotes with the host and
  proxied the static ones. Start each app's `serve-ssr` yourself.
