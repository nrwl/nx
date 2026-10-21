For an overview of the plugin and setup instructions, see the [@nx/eslint introduction](/docs/technologies/eslint/introduction).

The @nx/eslint plugin provides various migrations to help you migrate to newer versions of eslint projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.1.x

### `update-23-1-0-convert-to-flat-config`
**Version**: 23.1.0-beta.0

Convert remaining ESLint configs to flat config for ESLint v9 and keep the workspace lint-passing, disabling rules whose preset defaults changed.

#### Requires

| Name | Version |
|------|---------|
 `eslint` | `>=9.0.0` |

### `update-23-1-0-remove-removed-typescript-eslint-extension-rules`
**Version**: 23.1.0-beta.5

Handle typescript-eslint rules removed in v8 in ESLint flat configs, since referencing a removed rule stops the config from loading. Deletes the removed formatting/extension rules (e.g. @typescript-eslint/no-extra-semi) and rewrites the safe 1:1 renames (no-throw-literal -> only-throw-error, no-useless-template-literals -> no-unnecessary-template-expression) to preserve enforcement.


### `update-23-1-0-migrate-ban-types-rule`
**Version**: 23.1.0-beta.5

Migrate the removed @typescript-eslint/ban-types rule to its v8 successors (no-empty-object-type, no-unsafe-function-type, no-wrapper-object-types), whose options do not map 1:1 - so it is driven by an AI prompt rather than a deterministic codemod.


### 23.1.0-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `eslint` | `^9.8.0` | Updated only
| `typescript-eslint` | `^8.40.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.40.0` | Updated only
| `@typescript-eslint/parser` | `^8.40.0` | Updated only
| `@typescript-eslint/utils` | `^8.40.0` | Updated only
| `@typescript-eslint/type-utils` | `^8.40.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.40.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.40.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.40.0` | Updated only
| `eslint-config-prettier` | `^10.0.0` | Updated only


### 23.1.0-typescript-eslint-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.58.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.58.0` | Updated only
| `@typescript-eslint/parser` | `^8.58.0` | Updated only
| `@typescript-eslint/utils` | `^8.58.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.58.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.58.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.58.0` | Updated only


### 23.1.0-@typescript-eslint-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript-eslint` | `^8.58.0` | Updated only
| `@typescript-eslint/eslint-plugin` | `^8.58.0` | Updated only
| `@typescript-eslint/parser` | `^8.58.0` | Updated only
| `@typescript-eslint/utils` | `^8.58.0` | Updated only
| `@typescript-eslint/rule-tester` | `^8.58.0` | Updated only
| `@typescript-eslint/scope-manager` | `^8.58.0` | Updated only
| `@typescript-eslint/typescript-estree` | `^8.58.0` | Updated only



## 23.0.x

### `rewrite-eslint-internal-subpath-imports`
**Version**: 23.0.0-beta.17

Rewrites `@nx/eslint/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/eslint`'s exports map. Named imports/exports of public symbols are routed to `@nx/eslint` and the rest to the new `@nx/eslint/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/eslint/internal`.


### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/eslint/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/eslint` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/eslint/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/eslint/plugin';
```

##### After

```ts
import { createNodes } from '@nx/eslint/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/eslint/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




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


