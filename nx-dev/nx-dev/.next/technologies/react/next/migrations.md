For an overview of the plugin and setup instructions, see the [@nx/next introduction](/docs/technologies/react/next/introduction).

The @nx/next plugin provides various migrations to help you migrate to newer versions of next projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.2.x

### `update-23-2-0-add-svgr-webpack-if-used`
**Version**: 23.2.0-beta.4

Add `@svgr/webpack` when a next config references it.

#### Add `@svgr/webpack` If Used

Adds `@svgr/webpack` to the workspace when a next config references it.

`@svgr/webpack` is no longer a dependency of `@nx/next`, so workspaces whose next configs resolve it - which is what the Nx 22 `add-svgr-to-next-config` migration inlined - must declare it themselves. This migration backfills it for those workspaces. Workspaces that already have `@svgr/webpack` are left untouched.

#### Examples

##### Before

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/next": "23.1.0",
  },
}
```

##### After

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/next": "23.1.0",
    "@svgr/webpack": "^8.0.1",
  },
}
```




## 23.1.x

### `update-23-1-0-create-ai-instructions-for-next-15`
**Version**: 23.1.0-beta.0

Create AI instructions to help migrate workspaces from Next.js 14 to 15.

#### Requires

| Name | Version |
|------|---------|
 `next` | `>=15.0.0 <16.0.0` |
#### Upgrade Next.js 14 to 15

Bumps Next.js from 14 to 15 (and `eslint-config-next` to match). The main breaking change is that the request APIs (`params`, `searchParams`, `cookies`, `headers`, `draftMode`) are now asynchronous. App Router projects also require React 19; Page Router projects can stay on React 18. Read more in the [Next.js 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15).

The paired AI instructions migration walks an agent through the full set of changes. The common ones are shown below.

#### Examples

##### Before

```tsx title="app/blog/[slug]/page.tsx"
export default function Page({ params, searchParams }) {
  const { slug } = params;
  const query = searchParams.q;
  return <h1>{slug}</h1>;
}
```

##### After

```tsx title="app/blog/[slug]/page.tsx"
export default async function Page(props) {
  const { slug } = await props.params;
  const { q: query } = await props.searchParams;
  return <h1>{slug}</h1>;
}
```

`cookies`, `headers`, and `draftMode` are awaited the same way (`const store = await cookies();`).

#### Page Router

Pages Router data functions are not affected: `getServerSideProps` / `getStaticProps` / `getStaticPaths` `context.params` stays synchronous - leave it unchanged.



### 23.1.0-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `next` | `~15.5.18` | Updated only
| `eslint-config-next` | `^15.5.18` | Updated only



## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/next/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/next` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/next/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/next/plugin';
```

##### After

```ts
import { createNodes } from '@nx/next/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/next/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




## 22.6.x

### 22.6.0-package-updates
**Version**: 22.6.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `next` | `~16.1.6` | Updated only
| `eslint-config-next` | `^16.1.6` | Updated only



## 22.2.x

### `update-22-2-0-create-ai-instructions-for-next-16`
**Version**: 22.2.0-beta.1

Create AI Instructions to help migrate users workspaces to Next.js 16.

#### Requires

| Name | Version |
|------|---------|
 `next` | `>=16.0.0` |

### 22.2.0-beta.1-package-updates
**Version**: 22.2.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `next` | `~16.0.1` | Updated only
| `eslint-config-next` | `^16.0.1` | Updated only



## 22.0.x

### `update-22-0-0-add-svgr-to-next-config`
**Version**: 22.0.0-beta.0

Updates next.config.js files to add SVGR webpack configuration directly instead of using the nx.svgr option in withNx.


