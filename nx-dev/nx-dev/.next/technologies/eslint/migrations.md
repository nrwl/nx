The @nx/eslint plugin provides various migrations to help you migrate to newer versions of eslint projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.7.x

### `update-executor-lint-inputs`
**Version**: 22.7.0-beta.12

Add missing inputs to @nx/eslint:lint executor target defaults



## 21.5.x

### 21.5.0-typescript-eslint-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.40.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.40.0` | Updated only
| `@typescript-eslint/parser` | `^8.40.0` | Updated only
| `@typescript-eslint/utils` | `^8.40.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.40.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.40.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.40.0` | Updated only


### 21.5.0-@typescript-eslint-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.40.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.40.0` | Updated only
| `@typescript-eslint/parser` | `^8.40.0` | Updated only
| `@typescript-eslint/utils` | `^8.40.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.40.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.40.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.40.0` | Updated only



## 21.2.x

### 21.2.0-typescript-eslint-package-updates
**Version**: 21.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.29.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.29.0` | Updated only
| `@typescript-eslint/parser` | `^8.29.0` | Updated only
| `@typescript-eslint/utils` | `^8.29.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.29.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.29.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.29.0` | Updated only


### 21.2.0-@typescript-eslint-package-updates
**Version**: 21.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.29.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.29.0` | Updated only
| `@typescript-eslint/parser` | `^8.29.0` | Updated only
| `@typescript-eslint/utils` | `^8.29.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.29.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.29.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.29.0` | Updated only



## 20.7.x

### 20.7.0-package-updates
**Version**: 20.7.0-beta.4


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `eslint-config-prettier` | `^10.0.0` | Updated only



## 20.4.x

### 20.4.0-typescript-eslint-package-updates
**Version**: 20.4.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.19.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.19.0` | Updated only
| `@typescript-eslint/parser` | `^8.19.0` | Updated only
| `@typescript-eslint/utils` | `^8.19.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.19.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.19.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.19.0` | Updated only


### 20.4.0-@typescript-eslint-package-updates
**Version**: 20.4.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.19.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.19.0` | Updated only
| `@typescript-eslint/parser` | `^8.19.0` | Updated only
| `@typescript-eslint/utils` | `^8.19.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.19.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.19.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.19.0` | Updated only



## 20.3.x

### `add-file-extensions-to-overrides`
**Version**: 20.3.0-beta.1

Update ESLint flat config to include .cjs, .mjs, .cts, and .mts files in overrides (if needed)

#### Update ESLint Config File Extensions in Overrides

Update ESLint flat config to include .cjs, .mjs, .cts, and .mts files in overrides (if needed)

#### Sample Code Changes

Add `.cjs`, `.mjs`, `.cts`, `.mts` file extensions to overrides converted using `convert-to-flat-config`

##### Before

```js title="eslint.config.js"
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const nxEslintPlugin = require('@nx/eslint-plugin');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat
    .config({
      extends: ['plugin:@nx/typescript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      extends: ['plugin:@nx/javascript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.jsx'],
      rules: {
        ...config.rules,
      },
    })),
];
```

##### After

```js title="eslint.config.js" {17,28}
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const nxEslintPlugin = require('@nx/eslint-plugin');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat
    .config({
      extends: ['plugin:@nx/typescript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      extends: ['plugin:@nx/javascript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
      rules: {
        ...config.rules,
      },
    })),
];
```




## 20.2.x

### `update-typescript-eslint-v8.13.0`
**Version**: 20.2.0-beta.5

Update TypeScript ESLint packages to v8.13.0 if they are already on v8

#### Update TypeScript ESLint to v8.13.0

Update TypeScript ESLint packages to v8.13.0 if they are already on v8

#### Sample Code Changes

This migration will update `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` and `@typescript-eslint/utils` to `8.13.0` if they are between version `8.0.0` and `8.13.0`.

##### Before

```json title="package.json"
{
  "devDependencies": {
    "typescript-eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/utils": "^8.0.0"
  }
}
```

##### After

```json title="package.json"
{
  "devDependencies": {
    "typescript-eslint": "^8.13.0",
    "@typescript-eslint/eslint-plugin": "^8.13.0",
    "@typescript-eslint/parser": "^8.13.0",
    "@typescript-eslint/utils": "^8.13.0"
  }
}
```



