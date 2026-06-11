The @nx/rspack plugin provides various migrations to help you migrate to newer versions of rspack projects within your Nx workspace.
Below is a complete reference for all available migrations.

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



## 22.0.x

### `remove-deprecated-rspack-options`
**Version**: 22.0.0-beta.1

Remove deprecated deleteOutputPath and sassImplementation options from rspack configurations.



## 21.5.x

### 21.5.0-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@rspack/core` | `^1.5.0` | Updated only
| `@rspack/dev-server` | `^1.1.4` | Updated only



## 21.4.x

### 21.4.0-package-updates
**Version**: 21.4.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `http-proxy-middleware` | `^3.0.5` | Updated only



## 21.3.x

### 21.3.0-package-updates
**Version**: 21.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.17.0` | Updated only
| `@module-federation/node` | `^2.7.9` | Updated only



## 21.0.x

### 21.0.1-package-updates
**Version**: 21.0.1-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@rspack/core` | `^1.3.8` | Updated only
| `@rspack/dev-server` | `^1.1.1` | Updated only



## 20.5.x

### 20.5.0-package-updates
**Version**: 20.5.0-beta.4


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `sass-loader` | `^16.0.4` | Updated only
| `@rspack/core` | `^1.2.2` | Updated only



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




## 20.2.x

### `update-20-2-0-update-with-module-federation-import`
**Version**: 20.2.0-beta.3

Update the withModuleFederation import use @nx/module-federation/rspack.

#### Migrate withModuleFederation Import to New Package

Update the withModuleFederation import to use @nx/module-federation/rspack.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

##### Before

```ts title="apps/shell/rspack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/rspack/module-federation';
```

##### After

```ts title="apps/shell/rspack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/rspack';
```



### 20.2.0-package-updates
**Version**: 20.2.0-beta.7


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@rspack/core` | `^1.1.5` | Updated only
| `@rspack/dev-server` | `^1.0.9` | Updated only


