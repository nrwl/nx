For an overview of the plugin and setup instructions, see the [@nx/react introduction](/docs/technologies/react/introduction).

The @nx/react plugin provides various migrations to help you migrate to newer versions of react projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.2.x

### `update-23-2-0-add-optional-module-federation-packages`
**Version**: 23.2.0-beta.4

Add optional Module Federation packages when existing targets require them.

#### Add Optional Module Federation Packages

Adds `@nx/module-federation`, `express`, and `http-proxy-middleware` to the workspace when existing targets require them.

These packages are no longer direct dependencies of `@nx/react`; they are now optional peer dependencies, so installing `@nx/react` no longer pulls the Module Federation toolchain into workspaces that never use it. This migration backfills them for workspaces that already use Module Federation so those builds keep working after upgrading. Packages that are already present are left untouched.

A package is added only when a matching target exists:

- `@nx/module-federation`: an `@nx/react:module-federation-dev-server`, `@nx/react:module-federation-ssr-dev-server`, or `@nx/react:module-federation-static-server` target, or a project with a `module-federation.config.{js,ts}` file (covers remotes whose host lives in another workspace).
- `express` and `http-proxy-middleware`: an `@nx/react:module-federation-static-server` target, which proxies the static remotes.

Targets that inherit their executor from an `nx.json` `targetDefaults` entry are detected too.

#### Examples

For a workspace with an `@nx/react:module-federation-dev-server` serve target, the migration adds the Module Federation packages to `devDependencies`.

##### Before

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/react": "23.1.0",
  },
}
```

##### After

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/module-federation": "23.2.0",
    "@nx/react": "23.1.0",
  },
}
```



### `update-23-2-0-add-svgr-webpack-if-used`
**Version**: 23.2.0-beta.4

Add `@svgr/webpack` when a webpack config references it.

#### Add `@svgr/webpack` If Used

Adds `@svgr/webpack` to the workspace when a webpack config references it.

`@svgr/webpack` is no longer a dependency of `@nx/react`, so workspaces whose webpack configs resolve it - which is what the Nx 22 `add-svgr-to-webpack-config` migration inlined - must declare it themselves. This migration backfills it for those workspaces. Configs referenced by executor targets are checked, as well as the conventional config file names at each project root. Workspaces that already have `@svgr/webpack` are left untouched.

#### Examples

##### Before

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/react": "23.1.0",
  },
}
```

##### After

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/react": "23.1.0",
    "@svgr/webpack": "^8.0.1",
  },
}
```




## 23.1.x

### `update-23-1-0-create-ai-instructions-for-react-19`
**Version**: 23.1.0-beta.0

Create AI instructions to help migrate workspaces from React 18 to 19.

#### Requires

| Name | Version |
|------|---------|
 `react` | `>=19.0.0` |
#### Upgrade React 18 to 19

Bumps `react`, `react-dom`, and the React type packages from 18 to 19. React 19 removes several long-deprecated APIs; the change every project hits is the root API (`ReactDOM.render` -> `createRoot`). Read more in the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide).

The paired AI instructions migration walks an agent through the full set of changes. The common ones are shown below.

#### Examples

##### Before

```tsx title="src/main.tsx"
import ReactDOM from 'react-dom';

ReactDOM.render(<App />, document.getElementById('root'));
```

##### After

```tsx title="src/main.tsx"
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(<App />);
```

`defaultProps` on a function component becomes a default parameter:

##### Before

```tsx
function Badge({ color }) {}
Badge.defaultProps = { color: 'gray' };
```

##### After

```tsx
function Badge({ color = 'gray' }) {}
```



### 23.1.0-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `react` | `^19.0.0` | Updated only
| `react-dom` | `^19.0.0` | Updated only
| `react-is` | `^19.0.0` | Updated only
| `@types/react` | `^19.0.0` | Updated only
| `@types/react-dom` | `^19.0.0` | Updated only
| `@types/react-is` | `^19.0.0` | Updated only


### 23.1.0-eslint-plugin-react-package-updates
**Version**: 23.1.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `eslint-plugin-react` | `^7.35.0` | Updated only



## 23.0.x

### `update-23-0-0-remove-nx-react-webpack-plugin-import`
**Version**: 23.0.0-beta.10

Rewrites imports of NxReactWebpackPlugin from '@nx/react' to the sub-path '@nx/react/webpack-plugin'.

#### Rewrite `NxReactWebpackPlugin` Imports to the `@nx/react/webpack-plugin` Sub-path

The deprecated re-export of `NxReactWebpackPlugin` from `@nx/react` is removed in v23. The migration rewrites both ES module imports and CJS `require()` calls to use the `@nx/react/webpack-plugin` sub-path. Imports that combine the deprecated symbol with other named imports are split into two declarations so the rest of the original import still resolves from `@nx/react`. Aliases (`as Plugin`, `: Plugin`) are preserved.

#### Sample Code Changes

ES module import.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxReactWebpackPlugin } from '@nx/react';

export default { plugins: [new NxReactWebpackPlugin()] };
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';

export default { plugins: [new NxReactWebpackPlugin()] };
```

ES module import combined with other named imports.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxReactWebpackPlugin, withReact } from '@nx/react';
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxReactWebpackPlugin } from '@nx/react/webpack-plugin';
import { withReact } from '@nx/react';
```

CJS `require()`.

##### Before

```js title="apps/my-app/webpack.config.js" {1}
const { NxReactWebpackPlugin } = require('@nx/react');
```

##### After

```js title="apps/my-app/webpack.config.js"
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
```



### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/react/router-plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/react` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/react/router-plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/react/router-plugin';
```

##### After

```ts
import { createNodes } from '@nx/react/router-plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/react/router-plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### `rewrite-react-internal-subpath-imports`
**Version**: 23.0.0-beta.25

Rewrites `@nx/react/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/react`'s exports map. Named imports/exports of public symbols are routed to `@nx/react` and the rest to the new `@nx/react/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/react/internal`.



## 22.7.x

### 22.7.0-package-updates
**Version**: 22.7.0-beta.18


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `react-router` | `7.14.2` | Updated only
| `@react-router/dev` | `7.14.2` | Updated only
| `@react-router/node` | `7.14.2` | Updated only
| `@react-router/serve` | `7.14.2` | Updated only
| `@react-router/express` | `7.14.2` | Updated only
| `@react-router/fs-routes` | `7.14.2` | Updated only
| `@react-router/cloudflare` | `7.14.2` | Updated only
| `@react-router/architect` | `7.14.2` | Updated only
| `@react-router/remix-routes-option-adapter` | `7.14.2` | Updated only



## 22.6.x

### 22.6.0-package-updates
**Version**: 22.6.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^2.1.0` | Updated only
| `@module-federation/node` | `^2.7.21` | Updated only



## 22.3.x

### 22.3.4-package-updates
**Version**: 22.3.4-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `react-router-dom` | `6.30.3` | Updated only


### 22.3.4-react-router-package-updates
**Version**: 22.3.4-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `react-router` | `7.12.0` | Updated only
| `@react-router/dev` | `7.12.0` | Updated only
| `@react-router/node` | `7.12.0` | Updated only
| `@react-router/serve` | `7.12.0` | Updated only
| `@react-router/express` | `7.12.0` | Updated only
| `@react-router/fs-routes` | `7.12.0` | Updated only
| `@react-router/cloudflare` | `7.12.0` | Updated only
| `@react-router/architect` | `7.12.0` | Updated only
| `@react-router/remix-routes-option-adapter` | `7.12.0` | Updated only



## 22.2.x

### 22.2.0-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.21.2` | Updated only
| `@module-federation/runtime` | `^0.21.2` | Updated only
| `@module-federation/sdk` | `^0.21.2` | Updated only
| `@module-federation/node` | `^2.7.21` | Updated only


### 22.2.0-emotion-package-updates
**Version**: 22.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@emotion/react` | `11.14.0` | Updated only
| `@emotion/styled` | `11.14.1` | Updated only
| `@emotion/babel-plugin` | `11.13.5` | Updated only



## 22.0.x

### `update-22-0-0-add-svgr-to-webpack-config`
**Version**: 22.0.0-beta.0

Updates webpack configs using React to use the new withSvgr composable function instead of the svgr option in withReact or NxReactWebpackPlugin.



## 21.4.x

### 21.4.0-package-updates
**Version**: 21.4.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `http-proxy-middleware` | `^3.0.5` | Updated only



## 21.0.x

### `update-21-0-0-update-babel-loose`
**Version**: 21.0.0-beta.11

Replaces `classProperties.loose` option with `loose`.

#### Replace `classProperties.loose` option in `.babelrc`

The `classProperties.loose` option is replaced by `loose` in `.babelrc` files.

#### Sample Code Changes

##### Before

```json title=".babelrc"
{
  "presets": [
    [
      "@nx/react/babel",
      {
        "runtime": "automatic",
        "classProperties": {
          "loose": true
        },
        "useBuiltIns": "usage"
      }
    ]
  ],
  "plugins": []
}
```

##### After

```json title=".babelrc" {7}
{
  "presets": [
    [
      "@nx/react/babel",
      {
        "runtime": "automatic",
        "loose": true,
        "useBuiltIns": "usage"
      }
    ]
  ],
  "plugins": []
}
```



