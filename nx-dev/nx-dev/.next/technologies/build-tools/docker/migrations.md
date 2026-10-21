For an overview of the plugin and setup instructions, see the [@nx/docker introduction](/docs/technologies/build-tools/docker/introduction).

The @nx/docker plugin provides various migrations to help you migrate to newer versions of docker projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/docker` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/docker` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/docker` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/docker';
```

##### After

```ts
import { createNodes } from '@nx/docker';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/docker` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



