For an overview of the plugin and setup instructions, see the [@nx/storybook introduction](/docs/technologies/test-tools/storybook/introduction).

The @nx/storybook plugin provides various migrations to help you migrate to newer versions of storybook projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.2.x

### 23.2.0-test-runner-package-updates
**Version**: 23.2.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@storybook/test-runner` | `^0.24.0` | Updated only



## 23.1.x

### 23.1.0-package-updates
**Version**: 23.1.0-rc.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@storybook/angular` | `^10.5.0` | Updated only
| `@storybook/react` | `^10.5.0` | Updated only
| `storybook` | `^10.5.0` | Added if not installed
| `@storybook/addon-onboarding` | `^10.5.0` | Updated only
| `@storybook/addon-themes` | `^10.5.0` | Updated only
| `@storybook/builder-webpack5` | `^10.5.0` | Updated only
| `@storybook/core-webpack` | `^10.5.0` | Updated only
| `@storybook/html` | `^10.5.0` | Updated only
| `@storybook/html-vite` | `^10.5.0` | Updated only
| `@storybook/nextjs` | `^10.5.0` | Updated only
| `@storybook/preact` | `^10.5.0` | Updated only
| `@storybook/preact-vite` | `^10.5.0` | Updated only
| `@storybook/react-vite` | `^10.5.0` | Updated only
| `@storybook/react-webpack5` | `^10.5.0` | Updated only
| `@storybook/server` | `^10.5.0` | Updated only
| `@storybook/server-webpack5` | `^10.5.0` | Updated only
| `@storybook/svelte` | `^10.5.0` | Updated only
| `@storybook/svelte-vite` | `^10.5.0` | Updated only
| `@storybook/sveltekit` | `^10.5.0` | Updated only
| `@storybook/vue3` | `^10.5.0` | Updated only
| `@storybook/vue3-vite` | `^10.5.0` | Updated only
| `@storybook/web-components` | `^10.5.0` | Updated only
| `@storybook/web-components-vite` | `^10.5.0` | Updated only



## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/storybook/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/storybook` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/storybook/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/storybook/plugin';
```

##### After

```ts
import { createNodes } from '@nx/storybook/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/storybook/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




## 22.2.x

### 22.2.0-package-updates
**Version**: 22.2.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@storybook/angular` | `^10.1.0` | Updated only
| `@storybook/react` | `^10.1.0` | Updated only
| `storybook` | `^10.1.0` | Added if not installed
| `@storybook/addon-onboarding` | `^10.1.0` | Updated only
| `@storybook/addon-themes` | `^10.1.0` | Updated only
| `@storybook/builder-webpack5` | `^10.1.0` | Updated only
| `@storybook/core-webpack` | `^10.1.0` | Updated only
| `@storybook/html` | `^10.1.0` | Updated only
| `@storybook/html-vite` | `^10.1.0` | Updated only
| `@storybook/nextjs` | `^10.1.0` | Updated only
| `@storybook/preact` | `^10.1.0` | Updated only
| `@storybook/preact-vite` | `^10.1.0` | Updated only
| `@storybook/react-vite` | `^10.1.0` | Updated only
| `@storybook/react-webpack5` | `^10.1.0` | Updated only
| `@storybook/server` | `^10.1.0` | Updated only
| `@storybook/server-webpack5` | `^10.1.0` | Updated only
| `@storybook/svelte` | `^10.1.0` | Updated only
| `@storybook/svelte-vite` | `^10.1.0` | Updated only
| `@storybook/sveltekit` | `^10.1.0` | Updated only
| `@storybook/vue3` | `^10.1.0` | Updated only
| `@storybook/vue3-vite` | `^10.1.0` | Updated only
| `@storybook/web-components` | `^10.1.0` | Updated only
| `@storybook/web-components-vite` | `^10.1.0` | Updated only



## 22.1.x

### `update-22-1-0-migrate-storybook-v10`
**Version**: 22.1.0-beta.8

Update workspace to use Storybook v10

#### Requires

| Name | Version |
|------|---------|
 `storybook` | `>=10.0.0` |

### 21.1.0-package-updates
**Version**: 22.1.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@storybook/angular` | `^9.0.5` | Updated only
| `@storybook/react` | `^9.0.5` | Updated only
| `storybook` | `^9.0.5` | Added if not installed
| `@storybook/addon-onboarding` | `^9.0.5` | Updated only
| `@storybook/addon-themes` | `^9.0.5` | Updated only
| `@storybook/builder-webpack5` | `^9.0.5` | Updated only
| `@storybook/core-webpack` | `^9.0.5` | Updated only
| `@storybook/html` | `^9.0.5` | Updated only
| `@storybook/html-vite` | `^9.0.5` | Updated only
| `@storybook/nextjs` | `^9.0.5` | Updated only
| `@storybook/preact` | `^9.0.5` | Updated only
| `@storybook/preact-vite` | `^9.0.5` | Updated only
| `@storybook/react-vite` | `^9.0.5` | Updated only
| `@storybook/react-webpack5` | `^9.0.5` | Updated only
| `@storybook/server` | `^9.0.5` | Updated only
| `@storybook/server-webpack5` | `^9.0.5` | Updated only
| `@storybook/svelte` | `^9.0.5` | Updated only
| `@storybook/svelte-vite` | `^9.0.5` | Updated only
| `@storybook/sveltekit` | `^9.0.5` | Updated only
| `@storybook/vue3` | `^9.0.5` | Updated only
| `@storybook/vue3-vite` | `^9.0.5` | Updated only
| `@storybook/web-components` | `^9.0.5` | Updated only
| `@storybook/web-components-vite` | `^9.0.5` | Updated only


### 22.1.0-package-updates
**Version**: 22.1.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@storybook/angular` | `^10.0.0` | Updated only
| `@storybook/react` | `^10.0.0` | Updated only
| `storybook` | `^10.0.0` | Added if not installed
| `@storybook/addon-onboarding` | `^10.0.0` | Updated only
| `@storybook/addon-themes` | `^10.0.0` | Updated only
| `@storybook/builder-webpack5` | `^10.0.0` | Updated only
| `@storybook/core-webpack` | `^10.0.0` | Updated only
| `@storybook/html` | `^10.0.0` | Updated only
| `@storybook/html-vite` | `^10.0.0` | Updated only
| `@storybook/nextjs` | `^10.0.0` | Updated only
| `@storybook/preact` | `^10.0.0` | Updated only
| `@storybook/preact-vite` | `^10.0.0` | Updated only
| `@storybook/react-vite` | `^10.0.0` | Updated only
| `@storybook/react-webpack5` | `^10.0.0` | Updated only
| `@storybook/server` | `^10.0.0` | Updated only
| `@storybook/server-webpack5` | `^10.0.0` | Updated only
| `@storybook/svelte` | `^10.0.0` | Updated only
| `@storybook/svelte-vite` | `^10.0.0` | Updated only
| `@storybook/sveltekit` | `^10.0.0` | Updated only
| `@storybook/vue3` | `^10.0.0` | Updated only
| `@storybook/vue3-vite` | `^10.0.0` | Updated only
| `@storybook/web-components` | `^10.0.0` | Updated only
| `@storybook/web-components-vite` | `^10.0.0` | Updated only



## 21.2.x

### `update-21-2-0-migrate-storybook-v9`
**Version**: 21.2.0-beta.3

Update workspace to use Storybook v9

#### Requires

| Name | Version |
|------|---------|
 `storybook` | `>=9.0.0 <10.0.0` |

### `update-21-2-0-remove-addon-dependencies`
**Version**: 21.2.0-beta.3

Remove deprecated Storybook addon dependencies

#### Requires

| Name | Version |
|------|---------|
 `storybook` | `>=9.0.0 <10.0.0` |

