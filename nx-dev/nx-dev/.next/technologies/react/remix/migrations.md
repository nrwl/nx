For an overview of the plugin and setup instructions, see the [@nx/remix introduction](/docs/technologies/react/remix/introduction).

The @nx/remix plugin provides various migrations to help you migrate to newer versions of remix projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.1.x

### `update-23-1-0-remove-remix-eslint-config`
**Version**: 23.1.0-beta.0

Remove the unused @remix-run/eslint-config dependency (ESLint v8 only) that earlier Nx versions added but never wired into the generated lint setup.



## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/remix/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/remix` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/remix/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/remix/plugin';
```

##### After

```ts
import { createNodes } from '@nx/remix/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/remix/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




## 22.3.x

### 22.3.4-package-updates
**Version**: 22.3.4-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@remix-run/node` | `2.17.3` | Added if not installed
| `@remix-run/react` | `2.17.3` | Added if not installed
| `@remix-run/serve` | `2.17.3` | Added if not installed
| `@remix-run/dev` | `2.17.3` | Added if not installed
| `@remix-run/css-bundle` | `2.17.3` | Added if not installed
| `@remix-run/eslint-config` | `2.17.3` | Updated only
| `@remix-run/server-runtime` | `2.17.3` | Updated only
| `@remix-run/testing` | `2.17.3` | Updated only
| `@remix-run/express` | `2.17.3` | Updated only
| `@remix-run/cloudflare` | `2.17.3` | Updated only
| `@remix-run/cloudflare-pages` | `2.17.3` | Updated only
| `@remix-run/cloudflare-workers` | `2.17.3` | Updated only
| `@remix-run/architect` | `2.17.3` | Updated only
| `@remix-run/deno` | `2.17.3` | Updated only
| `@remix-run/route-config` | `2.17.3` | Updated only
| `@remix-run/fs-routes` | `2.17.3` | Updated only


