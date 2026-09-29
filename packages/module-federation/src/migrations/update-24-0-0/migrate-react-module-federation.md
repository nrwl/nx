# Migrate React apps off Nx Module Federation

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

Migrate this workspace off the Nx Module Federation APIs that Nx v24 removes, keeping each app's current bundler. Follow every step at https://nx.dev/docs/kb/migrate-from-nx-module-federation in order. Scope is React on Rspack and webpack. Stop and report if you find Angular apps.

Rules that override any shortcut you are tempted to take:

1. Before editing, run production builds and keep every `dist/apps/<app>/mf-stats.json`. Its `shared` array, `exposes`, and container name are what you reproduce. Do not derive sharing from package.json. If a host build fails with `Cannot find remote "<kebab-name>"`, rename the generated remote entries to the project names first.
2. Replace `withModuleFederation` and `NxModuleFederationPlugin` with `ModuleFederationPlugin` from `@module-federation/enhanced/rspack` or `/webpack`, and drop `NxModuleFederationDevServerPlugin`. Keep `NxAppRspackPlugin`, `NxAppWebpackPlugin`, `NxReactRspackPlugin`, `NxReactWebpackPlugin`. Do not switch bundlers or regenerate apps.
3. Set `name` to the project name with every character outside `[a-zA-Z0-9_$]` replaced by `_`, plus `filename: 'remoteEntry.js'`, `dts: false`, and `remoteType: 'script'` on webpack. Drop any `library` entry.
4. Write the `shared` map from the baseline `mf-stats.json`, copying `singleton`, `strictVersion`, `requiredVersion`, and `eager` per entry. Secondary entry points are separate keys. Give a source-only workspace library an explicit `version`, the stats value if it has no `package.json`. A workspace library imported by more than one app but missing from the stats was never shared, so adding it changes behavior. Report it.
5. Move a static host to a runtime manifest: `registerRemotes` with `type: 'global'` and full `remoteEntry.js` URLs, `loadRemote('<container-name>/<exposed>')` at the call sites (map a named export to `default`), and `implicitDependencies` on the host. A host that already calls `registerRemotes` is done as it is, including `mf-manifest.json` entries with no `type`. Keep static `remotes` entries only if the user asks to stay static.
6. Restore the bundler settings the wrapper used to set: `output.uniqueName`, `output.publicPath: 'auto'`, `output.clean: true`, app-plugin `commonChunk: false`, `devServer.hot: true` with an `Access-Control-Allow-Origin` header, `lazyCompilation: false` on Rspack, and `output.scriptType: 'text/javascript'` on webpack. `optimization.runtimeChunk` and the app-plugin `runtimeChunk` are `false` on remotes and on host production builds, and `'single'` (app-plugin `true`) on host development builds. Keep `extractLicenses` on for production only. Delete the old `module-federation.config.ts`, `rspack.config.ts` or `webpack.config.ts`, and `*.config.prod.*` in the same step you write the `.js` replacements.
7. Move `build` and `serve` to `nx:run-commands` running the Rspack or webpack CLI, with `NODE_ENV` per configuration. Add a `serve-static` target per app using `@nx/web:file-server` with `staticFilePath`, `dependsOn: ['build']`, `spa: true`, `watch: false`, never `buildTarget`. Point e2e web servers at `nx run-many -t serve-static -p <host> <remotes>`. For `@nx/cypress:cypress`, point `devServerTarget` at a continuous `nx:run-commands` target on the e2e project that runs that command with a `readyWhen` per app, and remove the e2e target's `port` option.
8. Remove `@nx/module-federation` only after the new setup builds and runs.
9. Do not claim hot-update parity, shared-state parity, or deployment-path correctness from a green build. Run the development flow with at least one remote served statically, and edit a host file and a live remote file to check hot updates. Report what you verified and what you did not.
10. For apps with a server build (a `server` target or a `*.server.config.*` file), also follow https://nx.dev/docs/kb/migrate-module-federation-ssr.

Nx v23 deprecates the Module Federation wrappers, runtime helpers, dev-server executors, and
generators that `@nx/module-federation`, `@nx/react`, `@nx/rspack`, and `@nx/angular` ship today.
Nx v24 will remove them. Their replacement is the official
[Module Federation](https://module-federation.io) plugins, which `withModuleFederation` already
wraps internally, so your Rspack apps stay on Rspack and your webpack apps stay on webpack.

Migrate before you upgrade to v24, while the old packages still work and you can compare the
result against a baseline you captured yourself. Nx will also ship migrations for this later.

> **Scope:** React apps on Rspack or webpack, keeping the same bundler. Server-side rendered apps follow these
> steps for the browser build, then
> [migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-module-federation-ssr). For Angular, see
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

The two unsupported entries coordinated processes rather than built code, and this migration
skips them. `NxModuleFederationDevServerPlugin` is the Rspack form of the dev-server executor,
which started each remote alongside the host so one `nx serve` brought the whole system up.
`@nx/react:module-federation-static-server` served every remote you were not developing from a
single port. You start the processes you want yourself now, which is why Step 5 moves remotes to
a runtime manifest.

Keep `NxAppRspackPlugin`, `NxAppWebpackPlugin`, `NxReactRspackPlugin`, and
`NxReactWebpackPlugin`. They are general bundler plugins and are not part of this removal.

> **The other route:** The `@nx/react:consumer` and `@nx/react:provider` generators create a new setup on Vite, Rsbuild,
> or Rspack, covered in [consumer and provider](https://nx.dev/docs/kb/consumer-and-provider). They regenerate
> apps rather than update them, so they suit a greenfield app or a look at what a current setup
> looks like. For a workspace you already ship, update the configs in place with the steps below.

## Capture a baseline first

Federation failures are quiet: a remote renders correctly while the host and the remote hold
separate copies of a shared library. Write down what works now, so you have something to compare
against:

- Serve the host and its remotes, and visit the routes that load each remote.
- Edit a file in the host and in a remote. Both should refresh the app.
- Run a production build and note the artifacts you depend on, such as each remote's
  `remoteEntry.js`. The official plugin can order or name chunks differently, so treat the
  federation config as the thing to reproduce rather than a byte-identical bundle.
- Copy each `dist/apps/<app>/mf-stats.json` out of `dist` before you rebuild. It holds the
  resolved `shared` map, `exposes`, and container name that Steps 3 and 4 reproduce.
- Note each app's `serve` port, which the remote URLs in Step 5 use.

Two build failures can block the baseline before you change anything:

- webpack 5.111 and later fail every production build with `@module-federation/enhanced` 2.9
  (`Path variable [contenthash:20] not implemented`), before and after this migration. Pin
  webpack to 5.110 or earlier until upstream fixes it.
- A host build that fails with `Cannot find remote "remote-a"` has kebab-case remote names that
  the Nx 23 `host` generator wrote for camelCase projects. Rename the `remotes` entries and the
  `import('<remote>/Module')` specifiers to the project names first.

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
production remote URLs, custom upstream options, and any runtime plugins. An app with a `server`
target or a `*.server.config.*` file is server-side rendered. Its server build also needs
[migrate server-side rendered apps](https://nx.dev/docs/kb/migrate-module-federation-ssr).

Stop if the search turns up Angular apps. Angular containers are ES modules and need different
settings, covered in [migrate Angular Module Federation](https://nx.dev/docs/kb/migrate-angular-module-federation).

## Step 2: install the official packages

A workspace built by the `host` generator already has `@module-federation/enhanced` in its root
`package.json`. Move it under `dependencies` if it sits in `devDependencies`, since application
code imports the federation runtime, then run your package manager's install so the lockfile
follows. Install it if it is missing:

```shell
npm add --save-prod @module-federation/enhanced
```

Step 7 runs the bundler CLI directly, so check that you have one. Rspack workspaces declare
`@rspack/cli` already. A webpack workspace that only ever built through the Nx executor usually
has no `webpack-cli`, even though `node_modules/.bin/webpack` exists:

```shell
npm add -D webpack-cli
```

Use `pnpm add`, `yarn add`, or `bun add` in place of `npm add` throughout. On pnpm, pass `-P` to
move a package that is already a devDependency, since a plain `pnpm add` leaves it where it is.

## Step 3: translate the federation config

Nx accepts a list of project names and resolves each one to a URL from the project graph. The
official plugin takes explicit values, so write them out.

Rspack apps from the Nx 23 `host` and `remote` generators have a plain
`rspack.config.ts` with `NxModuleFederationPlugin` and `NxModuleFederationDevServerPlugin`, built
by the inferred `@nx/rspack/plugin` targets. The `config` you pass to `NxModuleFederationPlugin` is
the federation config this step translates. Drop the dev-server plugin. There are no build-target
options to move in Step 6, and the generated `rspack.config.prod.ts` is never loaded by the
inferred build, so its remote URLs are the ones you write here.

### Container name and import alias

The container name is normalized. Every character outside `[a-zA-Z0-9_$]` becomes `_`, and so
does a leading character that cannot start an identifier, so `webpack-host` publishes as
`webpack_host`. Use that form for `name`.

The import alias stays the original project name. `webpackRemoteA/Module` keeps working because
the key in `remotes` is the alias, not the container name.

### Options Nx passed for you

Nx set `filename` to `remoteEntry.js`, set `remoteType` to `script` on webpack, and passed
through the `dts: false` override from your `withModuleFederation` call. Set all three yourself.
Without `dts: false`, every remote build logs
`[ Module Federation DTS ] Error ... #TYPE-001`.

Drop any `library` entry from the browser config. Nx never passed it to the plugin, and the
`{ type: 'var', name: '<project-name>' }` the generator wrote publishes an un-normalized global.
On Rspack a `var` or `window` type was what turned on `remoteType: 'script'` and
`output.scriptType: 'text/javascript'`, so carry those two by hand if your Rspack config had
such a `library`.

### Remote URLs

Each app lists only its direct remotes. A remote that consumes other remotes is both a provider
and a consumer, so it gets both maps.

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

Remote configs keep their `exposes` map as it is. Step 5 replaces a top-level host's `remotes`
map with a runtime manifest, so those URLs are needed only until then. A remote that consumes
other remotes keeps the map it writes here.

> **JavaScript config files:** The samples use CommonJS `.js` so the Rspack and webpack CLIs load them without a TypeScript
> loader. Node runs TypeScript configs directly on recent versions, so renaming them back to `.ts`
> is a reasonable follow-up once the migration is verified.

## Step 4: write the shared map

Nx derived `shared` from the project graph, covering framework packages, their secondary entry
points, every workspace library the app imports, and the npm dependencies of those libraries in
turn. The official plugin shares only what you list.

Read the values from the baseline `mf-stats.json` rather than deriving them, and copy
`singleton`, `strictVersion`, `requiredVersion`, and `eager` per entry:

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

Four things decide whether the map you write matches the one Nx produced:

- **Secondary entry points are separate keys.** A key such as `pkg` does not cover `pkg/subpath`
  requests, so list the subpaths the stats show.
- **`additionalShared` entries set their own values.** The same package can appear with a
  different range and no `strictVersion`, which is why you copy rather than derive. An entry the
  stats do not list was never used and can go.
- **The stats rewrite one field.** A callback that set `requiredVersion: false` shows up as
  `requiredVersion: '^<version>'`. For a workspace library, keep the `false` and the `version`
  your callback wrote.
- **A source-only workspace library needs an explicit `version`.** It has no published version
  for the plugin to compare, and `singleton: true` alone did not make host and remotes resolve to
  one copy in testing. Use the version the library declares or one your team agrees on, and do
  not give the same version to two different implementations. A library with no `package.json`
  shows `0.0.0` in the stats, so copy that value.

Check that every workspace library imported by more than one app appears in the stats. Nx found
workspace libraries through `tsconfig.base.json` paths, so in a workspace that links packages
through package manager workspaces instead, it never shared them and each app bundled its own
copy. Adding such a library to `shared`, with an explicit `version`, changes behavior from the
baseline, so record it as a change.

> **Imports have to use the library's package name:** A `shared` key matches the request string, so a library imported by a relative path into its
> source, rather than by its package name, resolves to a separate copy. Nx rewrote those requests
> for you and the official plugin does not.

A config that called `sharePackages`, `shareWorkspaceLibraries`, or `mapRemotes` keeps the same
shape once you replace each call with the values it returned, which the stats give you:

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

A runtime manifest holds the remote URLs in a file the host fetches at startup, so you change a
URL without rebuilding and the host boots whether or not a given remote is running. It is the
upstream default, documented in the
[manifest reference](https://module-federation.io/configure/manifest), and it is what replaces
the static server this migration removes.

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

Four things to get right:

- **Every value is a full entry URL.** `loadRemoteModule` appended `/remoteEntry.mjs` to a bare
  origin such as `http://localhost:4701`, and `registerRemotes` passes the string through
  unchanged. `output.publicPath: 'auto'` then resolves each remote's chunks against wherever its
  entry loaded from. A deployment path prefix belongs in the manifest you ship, not the one you
  run locally, since `@nx/web:file-server` serves each app at its own root.
- **Each key is the remote's normalized container name.** `type: 'global'` tells the runtime to
  read the container from `globalThis[name]`, which is how Nx built these remotes, so the key has
  to match the `name` from Step 3. Registration replaces the alias: the registered name is also
  the prefix `loadRemote` takes, so a project named `my-remote` is `my_remote` in the manifest and
  `loadRemote('my_remote/Module')` at the call site.
- **The host loses its project-graph edge.** A static `import('<remote>/Module')` gave Nx a
  host-to-remote edge. Once those imports are gone, add `implicitDependencies` on the host so the
  remotes still build first and `nx affected` still treats a remote change as affecting the host.
  In a workspace linked through package manager workspaces, a `workspace:*` dependency on each
  remote already gives that edge. You can also drop that host's `<remote>/Module` entries from `tsconfig.base.json` and any
  `remotes.d.ts`, since nothing imports those paths now.
- **Per-environment URLs move into the manifest.** The `NODE_ENV` ternary from Step 3 has no
  equivalent here. The manifest is an asset, so ship the one that belongs to each environment,
  through a `fileReplacements` pair or by writing the file at deploy time.

Only a top-level host converts. A remote that consumes other remotes keeps the static `remotes`
map from Step 3, because a host loads that remote's exposed module rather than its `main.ts`, so
a registration placed there never runs.

> **Staying with static remotes:** Keep the `remotes` map from Step 3 and the `tsconfig.base.json` paths, and skip this step. Every
> remote then has to be running before the host can boot, so serve them together:
> `nx run-many -t serve -p webpack-host webpackRemoteA webpackRemoteB`.

A host that already calls `init` or `registerRemotes` from the upstream runtime is done, whatever
generated it. The Nx 23 `--dynamic` host registers `mf-manifest.json` entries with no `type`, and
that keeps working because the official plugin still emits `mf-manifest.json`. That host never
had a graph edge to its remotes, so add `implicitDependencies` for them. A host that fetches a manifest and hands it to `setRemoteDefinitions` still needs
the conversion above, since that helper is one of the removed APIs. A host that used
`setRemoteUrlResolver` from `@nx/react/mf` to compute URLs keeps that logic and passes each
resolved URL as the `entry` in the same `registerRemotes` call.

## Step 6: swap the wrapper in the bundler config

`composePlugins(withNx(), withReact(), withModuleFederation(config))` returns an Nx-specific
config function that the Rspack and webpack CLIs cannot run. Replace it with a standard config
object that adds `ModuleFederationPlugin` itself, which is why `build` and `serve` move to the
CLI in Step 7.

The options on your old `build` target become `NxAppRspackPlugin` or `NxAppWebpackPlugin`
options. When you move them:

- Paths such as `main`, `index`, `tsConfig`, `assets`, and `styles` resolve from the project
  root, so `apps/webpack-host/src/main.ts` becomes `./src/main.ts`.
- `fileReplacements` paths resolve from the workspace root. Drop a pair whose files do not exist.
- Values that differed per named configuration become
  `process.env.NODE_ENV === 'production'` ternaries, which Step 7 sets per configuration. The
  generator's per-configuration `optimization`, `outputHashing`, `sourceMap`, `namedChunks`, and
  `vendorChunk` values match what the plugin derives from `NODE_ENV`, so they can go.
  `extractLicenses` is not derived, so keep it on for production only.
- Leave no build options behind on the target. The plugin merges whatever the running target
  still carries in `project.json`, and those win.

The wrapper also mutated the bundler config on its way through, so the config below sets those
values directly:

| Setting                     | Value                                                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output.uniqueName`         | The project name, not the normalized container name                                                                                                                                                                     |
| `output.publicPath`         | `'auto'`                                                                                                                                                                                                                |
| `output.clean`              | `true`. The Rspack app plugin defaults it, the webpack one does not, and without it a development build lands on top of production files                                                                                |
| `output.scriptType`         | `'text/javascript'` on webpack                                                                                                                                                                                          |
| `resolve.modules`           | `node_modules` plus the workspace root, which is what the wrapper set and what an `exposes` path written from the workspace root needs                                                                                  |
| `optimization.runtimeChunk` | `false` on remotes and on host production builds. On host development builds, `'single'`, or host edits apply without re-rendering. Set the app-plugin `runtimeChunk` to match, since it overwrites the top-level value |
| `commonChunk`               | `false` in the app-plugin options. `NxAppWebpackPlugin` defaults it to `true` where `withNx()` left it unset, which adds a `common.<hash>.js` per remote                                                                |
| `splitChunks.cacheGroups`   | `default` and `common` set to `false`, only if the old config used `NxModuleFederationPlugin`. `withModuleFederation` did not set them                                                                                  |
| `lazyCompilation` (Rspack)  | `false`. rspack-cli turns it on in dev mode and it breaks federation                                                                                                                                                    |
| `devServer.hot`             | `true` on every app, remotes included, so editing a remote updates the host instead of resetting its state                                                                                                              |
| `devServer.headers`         | `Access-Control-Allow-Origin`, which is what lets a host on one port fetch `remoteEntry.js` from another                                                                                                                |

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

> **These configs still run through Nx:** The app plugins read `NX_TASK_TARGET_PROJECT` and friends to find the project, so the config
> works under `nx run` and crashes if you call `npx webpack serve` from the app folder yourself.

The Nx dev server also derived `devMiddleware.publicPath` from `baseHref`, mapped `publicHost` to
`client.webSocketURL`, and passed `proxyConfig`, `allowedHosts`, and the `ssl` options through. A
workspace that served under a sub-path, behind a proxy, or over HTTPS carries each of those into
`devServer` by hand.

Delete the files the new ones replace in this same step: `module-federation.config.ts`,
`rspack.config.ts` or `webpack.config.ts`, and any `*.config.prod.*`. An inferred build still
loads the old `.ts` config while it exists, and its extensionless `./module-federation.config`
import now resolves to your new `.js` file, so every app fails with
`mfConfig.shared is not a function`.

## Step 7: update the targets

The official plugin federates the build. It does not coordinate processes, so the host's `serve`
no longer starts its remotes and you wire up the set you want.

Point `build` and `serve` at the bundler CLI, with `NODE_ENV` standing in for the named
configurations the executor used to pass:

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

With a runtime manifest from Step 5, you serve the host on its own and add remotes as you need
them, live or from their last build:

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

Build the remotes you serve statically with the development configuration when the host runs in
development. A development host and production-built remotes do not mix when their React versions
match. The runtime can pick the remote's production `react` while the host's
`react/jsx-dev-runtime` stays development, and the host renders a blank page with
`dispatcher.getOwner is not a function`. Run
`nx run-many -t build -p rspackRemoteB -c development` and then
`nx run-many -t serve-static -p rspackRemoteB --excludeTaskDependencies`, or serve those remotes
live. `shareStrategy: 'loaded-first'` also avoids the crash, but it stops remote edits from
updating the host.

> **Inferred targets:** If `nx.json` lists `@nx/rspack/plugin` or `@nx/webpack/plugin`, the inferred `build` and `serve`
> targets work as they are and only `serve-static` needs the shape above. Nx merges your
> `project.json` options over the inferred ones key by key, so the inferred `buildTarget` arrives
> next to your `staticFilePath`. Add `"buildTarget": ""` to your target to clear it.

`serve-static` serves the output with `staticFilePath` and leaves `buildTarget` unset, since the
file server rebuilds the app itself whenever that option is present, which duplicates the
`dependsOn` build and can fail with `Recursive task invocation detected` from inside an e2e run
that already built it. Keep `spa: true` on every app, or a refresh on a deep route returns a 404.

Point an e2e project's web server command at `nx run-many -t serve-static -p <host> <remotes>`,
with its URL on the host's `serve-static` port.

An e2e target on the `@nx/cypress:cypress` executor names a `devServerTarget` instead. Pointing it
at the app's own `serve` starts only the host, and the dev server then runs inside the e2e task,
where the app plugin resolves paths against the e2e project. Add a continuous target to the e2e
project that starts every app, with one `readyWhen` line per app, and point `devServerTarget` at
it:

```jsonc
// apps/webpack-host-e2e/project.json
{
  "targets": {
    "serve-mf": {
      "executor": "nx:run-commands",
      "continuous": true,
      "options": {
        "command": "nx run-many -t serve-static -p webpack-host webpackRemoteA webpackRemoteB",
        "readyWhen": [
          "Unhandled requests will be served from: http://localhost:4700",
          "Unhandled requests will be served from: http://localhost:4701",
          "Unhandled requests will be served from: http://localhost:4702",
        ],
      },
    },
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "apps/webpack-host-e2e/cypress.config.ts",
        "devServerTarget": "webpack-host-e2e:serve-mf",
        "testingType": "e2e",
      },
    },
  },
}
```

Remove the e2e target's `port` option, which Cypress passes on to the command, and the
`production` and `ci` configurations that pointed at the old targets.

Finally, remove the `targetDefaults` entries in `nx.json` keyed on `@nx/rspack:rspack` or
`@nx/webpack:webpack`. The `NX_MF_DEV_REMOTES` input they carried is dead. Move anything else
they held, such as `cache`, `inputs`, and `dependsOn`, onto the generic `build` default. Target
defaults also take a `filter`, so settings that applied to one executor can apply to a set of
projects instead:

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

A green build is not the acceptance criterion. The migration is done when everything you recorded
in the baseline works again, plus these:

- Production and development configurations both build with `--skipNxCache`, production last,
  since both write the same `mf-stats.json`.
- `tsc -p apps/<app>/tsconfig.app.json --noEmit` passes for each app. The app plugin type-checks
  asynchronously, so a build exits 0 on type errors.
- Each app's production `mf-stats.json` lists the same container name, exposes, and `shared`
  entries as the baseline. A host you moved to a runtime manifest has an empty build-time
  `remotes` by design, so check its manifest against the baseline URLs instead.
- The e2e suite passes against the replacement web server.
- In development, with at least one remote served statically, an edit to a host file and an edit
  to a live remote both update the page without a reload.

Record baseline failures separately rather than weakening an assertion to get a pass.

## Step 9: remove the package

Once the new setup builds and runs and no config or source file references the removed APIs,
remove the package:

```shell
npm remove @nx/module-federation
```

`@nx/rspack` on v23 depends on `@nx/module-federation`, so on an Rspack workspace it stays in
`node_modules` and its absence from `package.json` proves nothing. `@nx/react` lists it as an
optional peer, so on a webpack-only workspace `npm remove` takes it out. Keep
`@module-federation/enhanced` as a direct dependency and commit the lockfile.

## What the official plugins do not do

- **`--devRemotes` selection.** Which remotes run live and which serve from a build is now the
  set of targets you start. Rspack apps from the Nx 23 generators never accepted the flag. Their
  remotes carry `serve.dependsOn: ['<host>:serve']`, so `nx serve <remote>` starts the host too.
- **Runtime library control.** `withModuleFederation` attached a runtime plugin whenever the
  dev-server executor set `NX_MF_DEV_REMOTES`, so a live remote's copy of a shared library won
  over a static one. Nothing sets that variable now.
- **Automatic remote fallback.** A host whose remote is unavailable fails the request, so add
  your own error boundary if you need one.

For anything beyond this migration, such as runtime plugins, promise-based remotes, or
cross-version deployments, use the official
[configuration reference](https://module-federation.io/configure/) and
[runtime documentation](https://module-federation.io/guide/basic/runtime).

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
