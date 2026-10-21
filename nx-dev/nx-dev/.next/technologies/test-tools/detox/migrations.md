For an overview of the plugin and setup instructions, see the [@nx/detox introduction](/docs/technologies/test-tools/detox/introduction).

The @nx/detox plugin provides various migrations to help you migrate to newer versions of detox projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/detox/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/detox` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/detox/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/detox/plugin';
```

##### After

```ts
import { createNodes } from '@nx/detox/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/detox/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




## 22.2.x

### `update-22-0-0-remove-config-plugins-detox-for-expo-54`
**Version**: 22.2.0-beta.2

Remove @config-plugins/detox for Expo 54+ projects (package discontinued)

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 54.0.0` |


## 22.0.x

### 22.0.0-package-updates
**Version**: 22.0.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `detox` | `~20.43.0` | Updated only
| `@testing-library/jest-dom` | `~6.9.1` | Updated only


### 22.0.0-config-plugins-detox-package-updates
**Version**: 22.0.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@config-plugins/detox` | `~11.0.0` | Updated only


