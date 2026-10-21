For an overview of the plugin and setup instructions, see the [@nx/nuxt introduction](/docs/technologies/vue/nuxt/introduction).

The @nx/nuxt plugin provides various migrations to help you migrate to newer versions of nuxt projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/nuxt/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/nuxt` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/nuxt/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/nuxt/plugin';
```

##### After

```ts
import { createNodes } from '@nx/nuxt/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/nuxt/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




## 22.2.x

### `update-22-2-0-create-ai-instructions-for-nuxt-4`
**Version**: 22.2.0-beta.0

Create AI Instructions to help migrate workspaces to Nuxt 4.


### 22.2.0-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `nuxt` | `^4.0.0` | Updated only
| `@nuxt/eslint-config` | `^1.10.0` | Updated only
| `@nuxt/kit` | `^4.0.0` | Updated only
| `@nuxt/schema` | `^4.0.0` | Updated only
| `@nuxt/devtools` | `^3.0.0` | Updated only


