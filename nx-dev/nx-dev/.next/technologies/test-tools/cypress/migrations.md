For an overview of the plugin and setup instructions, see the [@nx/cypress introduction](/docs/technologies/test-tools/cypress/introduction).

The @nx/cypress plugin provides various migrations to help you migrate to newer versions of cypress projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.3.x

### `update-cypress-16-config-options`
**Version**: 23.3.0-beta.8

Renames `experimentalMemoryManagement` to `manageBrowserMemory`, replaces `experimentalFastVisibility` with `visibilityStrategy`, and removes `experimentalSourceRewriting`, `allowCypressEnv` and `execTimeout` from `cypress.config.{ts,js,mjs,cjs}`, matching the Cypress 16 config changes.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=16.0.0` |
#### Update Cypress config options renamed or removed in Cypress 16

Cypress 16 renamed `experimentalMemoryManagement` to `manageBrowserMemory` (now on by default), replaced `experimentalFastVisibility` with `visibilityStrategy` (`'modern'` by default, `'legacy'` deprecated), and removed `experimentalSourceRewriting`, `allowCypressEnv` and `execTimeout` (`cy.exec()` no longer exists). Cypress warns on startup while the old keys stay in the config.

This migration rewrites `cypress.config.{ts,js,mjs,cjs}` files of Cypress projects: it renames `experimentalMemoryManagement`, turns `experimentalFastVisibility: true` into `visibilityStrategy: 'modern'` and `experimentalFastVisibility: false` into `visibilityStrategy: 'legacy'`, and deletes the removed options. The config object is found behind `export default` or `module.exports`, through a `defineConfig()` call and through variables of the same file holding either. It edits the top level of the config object and the `e2e` and `component` blocks, inline or held in a variable of the same file, and the objects of the same file spread into any of them, and handles plain, quoted, shorthand and statically computed keys. A config object the migration cannot resolve statically is reported as a next step, and so is a spread of an import or a call, the `nxE2EPreset()` and `nxComponentTestingPreset()` spreads aside. A renamed shorthand key becomes `manageBrowserMemory: experimentalMemoryManagement`. A shorthand `experimentalFastVisibility` or `experimentalSourceRewriting` has a value the migration cannot read, so it is reported as a next step. When the new key is already set next to the old one, only the old key is removed. An `experimentalFastVisibility` value that is not a boolean literal is left in place and reported as a next step. Removing `execTimeout`, or `experimentalSourceRewriting: true`, is also reported as a next step: the `cy.task()` calls that replace `cy.exec()` use `taskTimeout`, and an application that pins resources with Subresource Integrity needs `removeSRIAttributes: true` instead of the source rewriter.

#### Sample code changes

##### Before

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  experimentalMemoryManagement: true,
  e2e: {
    baseUrl: 'http://localhost:4200',
    experimentalFastVisibility: true,
    execTimeout: 60000,
  },
});
```

##### After

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  manageBrowserMemory: true,
  e2e: {
    baseUrl: 'http://localhost:4200',
    visibilityStrategy: 'modern',
  },
});
```



### `update-cypress-16-query-command-overwrites`
**Version**: 23.3.0-beta.8

Renames `Cypress.Commands.overwrite()` to `Cypress.Commands.overwriteQuery()` for `getCookie`, `getCookies`, `getAllCookies`, `getAllLocalStorage` and `getAllSessionStorage`, which are queries in Cypress 16; an AI prompt then adapts the callbacks to the query contract.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=16.0.0` |
#### Overwrite the cookie and storage queries with `overwriteQuery` in Cypress 16

Cypress 16 turned `cy.getCookie()`, `cy.getCookies()`, `cy.getAllCookies()`, `cy.getAllLocalStorage()` and `cy.getAllSessionStorage()` into queries. Queries can only be overwritten with `Cypress.Commands.overwriteQuery()`, so an existing `Cypress.Commands.overwrite()` for any of them fails at runtime with "Queries can only be overwritten with `Cypress.Commands.overwriteQuery()`".

This migration renames those `Cypress.Commands.overwrite()` calls to `Cypress.Commands.overwriteQuery()` in every JavaScript and TypeScript file of the workspace, shared support libraries included; the `Cypress.Commands['overwrite']()` spelling is renamed too. A file that declares its own `Cypress` value (a variable, an import, a function, a class, an enum or a namespace holding a value; a type-only namespace and the usual `declare global { namespace Cypress { ... } }` augmentation are not ones) is left alone and listed as a next step. The callback contract differs: `overwriteQuery` calls the callback with the command as `this`, hands it the original query function, and expects it to return a function that computes the result from the subject, instead of a chainable. The original query reads `this` too, so the callback must be a `function` that forwards with `originalFn.call(this, ...)`; an arrow callback fails to typecheck (TS2684) and throws at runtime. Every renamed call is listed as a next step so the callback can be adapted by hand, and the paired AI prompt does that in agentic runs.

#### Sample code changes

##### Before

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwrite('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```

##### After the automatic rename (the callback still needs adapting)

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwriteQuery('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```

##### After adapting the callback by hand or through the AI prompt

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwriteQuery(
  'getCookie',
  function (originalFn, name, options) {
    return originalFn.call(this, name, { ...options, log: false });
  }
);
```



### `update-angular-zoneless-mount-import`
**Version**: 23.3.0-beta.8

Rewrites `cypress/angular-zoneless` and `@cypress/angular-zoneless` imports to `cypress/angular`, which is zoneless in Cypress 16 and the only Angular mount entry point it ships, and removes the deprecated `@cypress/angular-zoneless` package.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=16.0.0` |
#### Use `cypress/angular` for zoneless Angular component tests in Cypress 16

Cypress 16 removed the `cypress/angular-zoneless` entry point and deprecated the `@cypress/angular-zoneless` npm package. `cypress/angular` now mounts components with zoneless change detection and supports Angular 21 and later. Imports of `cypress/angular-zoneless` fail to resolve on Cypress 16.

This migration rewrites `cypress/angular-zoneless` and `@cypress/angular-zoneless` module references to `cypress/angular` in every JavaScript and TypeScript file of the workspace, shared support libraries included: `import` and `export ... from` declarations, `import type`, dynamic `import()`, `require()` and `typeof import()` types. A `require()` call in a file that declares its own `require` value is left alone and listed as a next step. It also removes the `@cypress/angular-zoneless` package from `package.json` when it is installed.

#### Sample code changes

##### Before

```ts title="apps/myapp/cypress/support/component.ts"
import { mount } from 'cypress/angular-zoneless';
```

##### After

```ts title="apps/myapp/cypress/support/component.ts"
import { mount } from 'cypress/angular';
```



### `create-ai-instructions-for-cypress-16`
**Version**: 23.3.0-beta.8

AI-assisted migration: replaces `Cypress.env()`, `cy.exec()`, `.end()`, `env` test-configuration overrides and runtime `Cypress.config()` writes removed in Cypress 16, whose replacements depend on where each value comes from, so it is driven by an AI prompt rather than a deterministic generator.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=16.0.0` |
#### Upgrade Cypress 15 to 16

Bumps `cypress` to 16 together with the declared `@cypress/vite-dev-server` (to 8) and `@cypress/webpack-dev-server` (to 6); a package manager catalog entry is bumped in the catalog. Cypress 16 component testing rejects a Vite below 8, so the migration first reads the bundler of every Cypress config's `component` block, following same-file spreads and variables, and resolves `vite` from that config's directory, as Cypress does. When a Vite component testing project, or a config whose bundler cannot be read statically, resolves a Vite below 8, the workspace stays on Cypress 15 and the migration reports the command to run once Vite is on 8. It does not check a Cypress config with a custom name that no `@nx/cypress:cypress` target references, such as one run through `nx:run-commands`. A Vite that only e2e or webpack component testing projects resolve, such as a transitive Vite hoisted to the workspace root, does not hold the bump. Cypress 16 removes `Cypress.env()` (replaced by the asynchronous `cy.env()` for `env` values and `Cypress.expose()` for the new `expose` values), `cy.exec()` (use `cy.task()`) and `.end()`, drops `env` from test configuration overrides, turns the cookie and storage getters into queries, drops CoffeeScript support, and routes Chrome, Chromium and Edge through the native browser network. It requires Node 22, 24 or 26+, Vite 8 for Vite component testing, Angular 21 for Angular component testing and Next.js 15.0.4 for component testing on Cypress's `next` dev server framework, which the Nx preset does not use. Read more in the [Cypress 16 migration guide](https://docs.cypress.io/app/references/migration-guide#Migrating-to-Cypress-160).

After the bump, the migration updates the renamed and removed config options, the `cypress/angular-zoneless` import and the `Cypress.Commands.overwrite()` calls for the new queries; a workspace already on Cypress 16 gets the same rewrites from their standalone migrations. The paired AI instructions walk an agent through the source changes that need judgment. The most common one is shown below.

#### Examples

##### Before

```ts title="apps/myapp-e2e/src/e2e/app.cy.ts"
const apiUrl = Cypress.env('API_URL');

it('is healthy', () => {
  cy.request(`${apiUrl}/health`).its('status').should('eq', 200);
});
```

##### After

```ts title="apps/myapp-e2e/src/e2e/app.cy.ts"
it('is healthy', () => {
  cy.env(['API_URL']).then(({ API_URL }) => {
    cy.request(`${API_URL}/health`).its('status').should('eq', 200);
  });
});
```



### `upgrade-to-cypress-16`
**Version**: 23.3.0-beta.8

Moves a Cypress 15 workspace to Cypress 16: bumps `cypress` and the declared `@cypress/*-dev-server` packages unless a Vite component testing config, or a config whose bundler cannot be determined statically, resolves a Vite below 8, applies the Cypress 16 config option, `overwriteQuery` and `cypress/angular` rewrites, and hands the remaining source changes to an AI prompt.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.0.0 <16.0.0` |
#### Upgrade Cypress 15 to 16

Bumps `cypress` to 16 together with the declared `@cypress/vite-dev-server` (to 8) and `@cypress/webpack-dev-server` (to 6); a package manager catalog entry is bumped in the catalog. Cypress 16 component testing rejects a Vite below 8, so the migration first reads the bundler of every Cypress config's `component` block, following same-file spreads and variables, and resolves `vite` from that config's directory, as Cypress does. When a Vite component testing project, or a config whose bundler cannot be read statically, resolves a Vite below 8, the workspace stays on Cypress 15 and the migration reports the command to run once Vite is on 8. It does not check a Cypress config with a custom name that no `@nx/cypress:cypress` target references, such as one run through `nx:run-commands`. A Vite that only e2e or webpack component testing projects resolve, such as a transitive Vite hoisted to the workspace root, does not hold the bump. Cypress 16 removes `Cypress.env()` (replaced by the asynchronous `cy.env()` for `env` values and `Cypress.expose()` for the new `expose` values), `cy.exec()` (use `cy.task()`) and `.end()`, drops `env` from test configuration overrides, turns the cookie and storage getters into queries, drops CoffeeScript support, and routes Chrome, Chromium and Edge through the native browser network. It requires Node 22, 24 or 26+, Vite 8 for Vite component testing, Angular 21 for Angular component testing and Next.js 15.0.4 for component testing on Cypress's `next` dev server framework, which the Nx preset does not use. Read more in the [Cypress 16 migration guide](https://docs.cypress.io/app/references/migration-guide#Migrating-to-Cypress-160).

After the bump, the migration updates the renamed and removed config options, the `cypress/angular-zoneless` import and the `Cypress.Commands.overwrite()` calls for the new queries; a workspace already on Cypress 16 gets the same rewrites from their standalone migrations. The paired AI instructions walk an agent through the source changes that need judgment. The most common one is shown below.

#### Examples

##### Before

```ts title="apps/myapp-e2e/src/e2e/app.cy.ts"
const apiUrl = Cypress.env('API_URL');

it('is healthy', () => {
  cy.request(`${apiUrl}/health`).its('status').should('eq', 200);
});
```

##### After

```ts title="apps/myapp-e2e/src/e2e/app.cy.ts"
it('is healthy', () => {
  cy.env(['API_URL']).then(({ API_URL }) => {
    cy.request(`${API_URL}/health`).its('status').should('eq', 200);
  });
});
```




## 23.2.x

### 23.2.0-cypress-15.20.1-package-updates
**Version**: 23.2.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^15.20.1` | Updated only



## 23.1.x

### `disable-webpack-ct-just-in-time-compile`
**Version**: 23.1.0-beta.6

Set `justInTimeCompile: false` in webpack component testing Cypress configs on Cypress 14+, where it defaults to true and can intermittently run 0 tests in CI.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=14.0.0` |
#### Disable `justInTimeCompile` for webpack component testing

Cypress 14+ defaults `justInTimeCompile` to `true` for the webpack dev server, compiling each spec on demand. In run mode the runner can load a component test before its spec finishes compiling, so the spec executes 0 tests while the run still exits green - a false pass that hides broken component tests in CI.

This migration sets an explicit `justInTimeCompile: false` in the Cypress configs of webpack component testing projects, keeping the choice visible and reversible. Remove the line to opt back into just-in-time compilation.

#### Sample Code Changes

##### Before

```ts title="apps/my-app/cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
```

##### After

```ts title="apps/my-app/cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    // Cypress 14+ defaults justInTimeCompile to true (webpack only), which can
    // intermittently run 0 tests in CI. Remove this line to opt back in.
    justInTimeCompile: false,
  },
});
```

#### What is not changed

`justInTimeCompile` only applies to the webpack dev server, so vite-based component testing is left untouched. This migration skips vite configs (including `@nx/remix`, which uses the vite dev server), configs that already set `justInTimeCompile`, and e2e-only configs.



### 23.0.0-cypress-15.17-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^15.17.0` | Updated only


### 23.1.0-eslint-plugin-cypress-package-updates
**Version**: 23.1.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `eslint-plugin-cypress` | `^3.5.0` | Updated only



## 23.0.x

### `remove-experimental-prompt-command`
**Version**: 23.0.0-beta.10

Removes the `experimentalPromptCommand` flag from `cypress.config.{ts,js,mjs,cjs}`. The flag was removed in Cypress 15.13.0; `cy.prompt` is now in beta without configuration.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.13.0` |
#### Remove the `experimentalPromptCommand` Flag from Cypress Config

Removes the `experimentalPromptCommand` flag from `cypress.config.{ts,js,mjs,cjs}` files. The flag was removed in [Cypress 15.13.0](https://github.com/cypress-io/cypress/releases/tag/v15.13.0); `cy.prompt` is now in beta without configuration. Leaving the flag in place causes Cypress to error at startup.

#### Sample Code Changes

Remove `experimentalPromptCommand` from the top level of `defineConfig`.

##### Before

```ts title="apps/myapp-e2e/cypress.config.ts" {5}
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: { baseUrl: 'http://localhost:4200' },
  experimentalPromptCommand: true,
});
```

##### After

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: { baseUrl: 'http://localhost:4200' },
});
```

The flag is also removed when nested inside `e2e` or `component`.

##### Before

```ts title="apps/myapp-e2e/cypress.config.ts" {5}
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    experimentalPromptCommand: true,
    baseUrl: 'http://localhost:4200',
  },
});
```

##### After

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
  },
});
```



### `rewrite-internal-subpath-imports`
**Version**: 23.0.0-beta.19

Rewrites imports from `@nx/cypress/src/*` to either the public `@nx/cypress` entry (for re-exported symbols) or `@nx/cypress/internal` (for everything else). The `./src/*` wildcard was removed from the package's exports map.


### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/cypress/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/cypress` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/cypress/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/cypress/plugin';
```

##### After

```ts
import { createNodes } from '@nx/cypress/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/cypress/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-package-updates
**Version**: 23.0.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^15.14.2` | Updated only


### 23.0.0-vite-dev-server-package-updates
**Version**: 23.0.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@cypress/vite-dev-server` | `^7.3.1` | Updated only



## 22.3.x

### 22.3.2-package-updates
**Version**: 22.3.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^15.8.0` | Updated only
| `@cypress/webpack-dev-server` | `^5.4.1` | Updated only



## 22.1.x

### `rename-cy-exec-code-property`
**Version**: 22.1.0-beta.6

Renames `cy.exec().its('code')` usages to the new `exitCode` property introduced in Cypress v15.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.0.0` |
#### Rename `cy.exec().its('code')` to `cy.exec().its('exitCode')`

Cypress v15 renamed the result property exposed by `cy.exec()` from `code` to `exitCode`. This migration updates Cypress spec files managed by Nx so that assertions such as `cy.exec(...).its('code')` use the new `exitCode` property.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#cyexec-code-property-renamed).

#### Examples

##### Before

```ts title="apps/app-e2e/src/e2e/sample.cy.ts"
cy.exec('echo 0').its('code').should('eq', 0);
```

##### After

```ts title="apps/app-e2e/src/e2e/sample.cy.ts"
cy.exec('echo 0').its('exitCode').should('eq', 0);
```



### `update-selector-playground-api`
**Version**: 22.1.0-beta.6

Updates the deprecated `Cypress.SelectorPlayground` API to `Cypress.ElementSelector` and removes the unsupported `onElement` option.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.0.0` |
#### Update the Selector Playground API

Cypress v15 renamed `Cypress.SelectorPlayground` to `Cypress.ElementSelector` and removed the deprecated `onElement` option when calling `Cypress.ElementSelector.defaults()`. This migration updates existing Cypress support files to use the new API.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#Selector-Playground-API-changes).

#### Examples

##### Before

```ts title="apps/web-e2e/src/support/selector.ts"
Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-cy'],
  onElement: (el) => el,
});
```

##### After

```ts title="apps/web-e2e/src/support/selector.ts"
Cypress.ElementSelector.defaults({
  selectorPriority: ['data-cy'],
});
```



### `update-angular-component-testing-support`
**Version**: 22.1.0-beta.6

For Angular component testing projects below v18, switches to the fallback `@cypress/angular` harness required by Cypress v15.

#### Requires

| Name | Version |
|------|---------|
 `cypress` | `>=15.0.0` |
#### Use the fallback Angular component testing harness for Cypress v15

Cypress v15 requires Angular component testing projects running Angular versions below 18 to migrate from the built-in `cypress/angular` helper to the `@cypress/angular` harness (v3). This migration updates component testing imports and ensures the correct dependency is installed.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#Angular-17-CT-no-longer-supported).

#### Examples

##### Before

```ts title="apps/dashboard/src/app/app.component.cy.ts"
import { mount } from 'cypress/angular';
```

##### After

```ts title="apps/dashboard/src/app/app.component.cy.ts"
import { mount } from '@cypress/angular';
```



### 22.1.0-package-updates
**Version**: 22.1.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `cypress` | `^15.6.0` | Updated only
| `@cypress/vite-dev-server` | `^7.0.1` | Updated only
| `@cypress/webpack-dev-server` | `^5.1.4` | Updated only



## 21.0.x

### `remove-tsconfig-and-copy-files-options-from-cypress-executor`
**Version**: 21.0.0-beta.10

Removes the `tsConfig` and `copyFiles` options from the `@nx/cypress:cypress` executor.

#### Remove `tsConfig` and `copyFiles` Options from Cypress Executor

Removes the previously deprecated and unused `tsConfig` and `copyFiles` options from the `@nx/cypress:cypress` executor configuration in all projects.

#### Examples

Remove the options from the project configuration:

##### Before

```json title="apps/app1-e2e/project.json" {7-8}
{
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "apps/app1-e2e/cypress.config.ts",
        "tsConfig": "apps/app1-e2e/tsconfig.json",
        "copyFiles": "**/*.spec.ts",
        "devServerTarget": "app1:serve"
      }
    }
  }
}
```

##### After

```json title="apps/app1-e2e/project.json"
{
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "apps/app1-e2e/cypress.config.ts",
        "devServerTarget": "app1:serve"
      }
    }
  }
}
```

Remove the options from a target default using the `@nx/cypress:cypress` executor:

##### Before

```json title="nx.json" {7-8}
{
  "targetDefaults": {
    "e2e": {
      "cache": true,
      "executor": "@nx/cypress:cypress",
      "options": {
        "tsConfig": "{projectRoot}/tsconfig.json",
        "copyFiles": "**/*.spec.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "e2e": {
      "cache": true,
      "executor": "@nx/cypress:cypress"
    }
  }
}
```

Remove the options from a target default using the `@nx/cypress:cypress` executor as the key:

##### Before

```json title="nx.json" {6-7}
{
  "targetDefaults": {
    "@nx/cypress:cypress": {
      "cache": true,
      "options": {
        "tsConfig": "{projectRoot}/tsconfig.json",
        "copyFiles": "**/*.spec.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/cypress:cypress": {
      "cache": true
    }
  }
}
```



