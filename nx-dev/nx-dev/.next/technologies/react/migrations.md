The @nx/react plugin provides various migrations to help you migrate to newer versions of react projects within your Nx workspace.
Below is a complete reference for all available migrations.

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




## 20.4.x

### `add-mf-env-var-to-target-defaults`
**Version**: 20.4.0-beta.0

Add NX_MF_DEV_REMOTES to inputs for task hashing when '@nx/webpack:webpack' or '@nx/rspack:rspack' is used for Module Federation.

#### Add Module Federation Env Var to Target Defaults

Add NX_MF_DEV_REMOTES to inputs for task hashing when `@nx/webpack:webpack` or `@nx/rspack:rspack` is used for Module Federation.

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/webpack:webpack": {
      "inputs": ["^build"]
    }
  }
}
```

##### After

```json title="nx.json" {4-6}
{
  "targetDefaults": {
    "@nx/webpack:webpack": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": [
        "^build",
        {
          "env": "NX_MF_DEV_REMOTES"
        }
      ]
    }
  }
}
```




## 20.3.x

### `ensure-nx-module-federation-package`
**Version**: 20.3.0-beta.2

If workspace includes Module Federation projects, ensure the new @nx/module-federation package is installed.

#### Ensure the @nx/module-federation Package is Installed

If workspace includes Module Federation projects, ensure the new `@nx/module-federation` package is installed.

#### Sample Code Changes

##### Before

```json title="package.json"
{
  "dependencies": {}
}
```

##### After

```json title="package.json"
{
  "dependencies": {
    "@nx/module-federation": "20.3.0"
  }
}
```



### 20.3.0-package-updates
**Version**: 20.3.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@testing-library/react` | `16.1.0` | Updated only



## 20.2.x

### `update-20-2-0-update-module-federation-config-import`
**Version**: 20.2.0-beta.2

Update the ModuleFederationConfig import use @nx/module-federation.

#### Migrate Module Federation Imports to New Package

Update the ModuleFederationConfig imports to use @nx/module-federation.

#### Sample Code Changes

Update import paths for ModuleFederationConfig.

##### Before

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/webpack';
```

```js title="apps/shell/rspack.config.js"
import { ModuleFederationConfig } from '@nx/rspack/module-federation';
```

##### After

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/module-federation';
```

```js title="apps/shell/rspack.config.js"
import { ModuleFederationConfig } from '@nx/module-federation';
```



### `update-20-2-0-update-with-module-federation-import`
**Version**: 20.2.0-beta.2

Update the withModuleFederation import use @nx/module-federation/webpack.

#### Migrate withModuleFederation Import to New Package

Update the withModuleFederation import to use @nx/module-federation/webpack.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

##### Before

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/react/module-federation';
```

##### After

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/webpack';
```



### 20.2.0-package-updates
**Version**: 20.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `0.7.6` | Updated only
| `@module-federation/runtime` | `0.7.6` | Updated only
| `@module-federation/sdk` | `0.7.6` | Updated only
| `@module-federation/node` | `2.6.11` | Updated only



## 20.1.x

### 20.1.0-package-updates
**Version**: 20.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `eslint-plugin-react-hooks` | `5.0.0` | Updated only
| `eslint-plugin-jsx-a11y` | `6.10.1` | Updated only



## 20.0.x

### 20.0.0-package-updates
**Version**: 20.0.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `eslint-plugin-import` | `2.31.0` | Updated only


