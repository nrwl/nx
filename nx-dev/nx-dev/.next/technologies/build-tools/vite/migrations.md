The @nx/vite plugin provides various migrations to help you migrate to newer versions of vite projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.2.x

### `update-22-2-0`
**Version**: 22.2.0-beta.1

Create AI Instructions to help migrate users workspaces past breaking changes for Vitest 4.

#### Requires

| Name | Version |
|------|---------|
 `vitest` | `>=4.0.0` |

### `migrate-vitest-to-vitest-package`
**Version**: 22.2.0-beta.2

Migrate Vitest usage from @nx/vite to @nx/vitest package.


### 22.2.0-package-updates
**Version**: 22.2.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^4.0.0` | Updated only
| `@vitest/coverage-v8` | `^4.0.0` | Updated only
| `@vitest/coverage-istanbul` | `^4.0.0` | Updated only
| `@vitest/ui` | `^4.0.0` | Updated only


### 22.2.0-analog-package-updates
**Version**: 22.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~2.1.2` | Updated only
| `@analogjs/vitest-angular` | `~2.1.2` | Updated only



## 21.5.x

### 21.5.0-package-updates
**Version**: 21.5.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vite` | `^7.1.3` | Updated only



## 21.3.x

### 21.3.0-package-updates
**Version**: 21.3.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~1.19.1` | Updated only
| `@analogjs/vitest-angular` | `~1.19.1` | Updated only



## 21.2.x

### 21.2.0-package-updates
**Version**: 21.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~1.17.1` | Updated only
| `@analogjs/vitest-angular` | `~1.17.1` | Updated only



## 21.1.x

### 21.1.2-package-updates
**Version**: 21.1.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vitest-angular` | `~1.16.1` | Updated only



## 20.7.x

### 20.7.1-package-updates
**Version**: 20.7.1-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~1.14.1` | Updated only
| `@analogjs/vitest-angular` | `~1.14.1` | Updated only



## 20.5.x

### `update-20-5-0-install-jiti`
**Version**: 20.5.0-beta.2

Install jiti as a devDependency to allow vite to parse TS postcss files.

#### Installs the `jiti` package

This migration ensures that the [`jiti`](https://github.com/unjs/jiti) package is installed.  
This is a requirement for Vite to parse `postcss` configuration files that use TypeScript.

Learn more: [https://vite.dev/guide/migration#postcss-load-config](https://vite.dev/guide/migration#postcss-load-config)



### `update-20-5-0-update-resolve-conditions`
**Version**: 20.5.0-beta.3

Update resolve.conditions to include defaults that are no longer provided by Vite.

#### Update `resolve.conditions` to include defaults

In previous Vite versions, the `resolve.conditions` option had defaults that were added internally (i.e. `['module', 'browser', 'development|production']`).  
This default was removed in Vite 6, so this migration adds it to your existing configuration to ensure that the behavior remains intact.

Learn more: [https://vite.dev/guide/migration#default-value-for-resolve-conditions](https://vite.dev/guide/migration#default-value-for-resolve-conditions)

:::note[Remix]
Remix does not currently support Vite 6 and therefore any `vite.config` file for Remix will not be migrated.
:::

#### Sample Code Changes

##### Before

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['require'],
  },
  build: {
    outDir: 'dist',
  },
});
```

##### After

```typescript title="vite.config.ts" {4-6}
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['require', 'module', 'browser', 'development|production'],
  },
  build: {
    outDir: 'dist',
  },
});
```



### `eslint-ignore-vite-temp-files`
**Version**: 20.5.0-beta.3

Add vite config temporary files to the ESLint configuration ignore patterns if ESLint is used.

#### Sample Code Changes

Add `vite.config.*.timestamp*` and `vitest.config.*.timestamp*` to the root `eslint.config.mjs` file (using **ESLint Flat Config**).

##### Before

```js title="eslint.config.mjs"
export default [
  {
    ignores: ['dist'],
  },
];
```

##### After

```js title="eslint.config.mjs" {3}
export default [
  {
    ignores: ['dist', 'vite.config.*.timestamp*', 'vitest.config.*.timestamp*'],
  },
];
```

Add `vite.config.*.timestamp*` and `vitest.config.*.timestamp*` to the project's `.eslintrc.json` file (using **eslintrc** format config).

##### Before

```json title="apps/app1/eslintrc.json"
{
  "ignorePatterns": ["!**/*"]
}
```

##### After

```json title="apps/app1/eslintrc.json" {4-5}
{
  "ignorePatterns": [
    "!**/*",
    "vite.config.*.timestamp*",
    "vitest.config.*.timestamp*"
  ]
}
```



### 20.5.0-package-updates
**Version**: 20.5.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vite` | `^6.0.0` | Updated only
| `vite-plugin-dts` | `~4.5.0` | Updated only



## 20.0.x

### `update-20-0-4`
**Version**: 20.0.4-beta.0

Add gitignore entry for temporary vite config files.

#### Add Vite Temp Files to Git Ignore

Add gitignore entry for temporary vite config files.

#### Sample Code Changes

Adds the following entries to the `.gitignore` file.

```text title=".gitignore"
vite.config.*.timestamp*
vitest.config.*.timestamp*
```



### `update-20-0-6`
**Version**: 20.0.6-beta.0

Add gitignore entry for temporary vite config files and remove previous incorrect glob.

#### Add Vite Temp Files to Git Ignore

Add gitignore entry for temporary vite config files.

#### Sample Code Changes

Adds the following entries to the `.gitignore` file.

```text title=".gitignore"
vite.config.*.timestamp*
vitest.config.*.timestamp*
```



