For an overview of the plugin and setup instructions, see the [@nx/maven introduction](/docs/technologies/java/maven/introduction).

The @nx/maven plugin provides various migrations to help you migrate to newer versions of maven projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.26

Rename imports of `createNodesV2` from `@nx/maven` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/maven` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/maven` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/maven';
```

##### After

```ts
import { createNodes } from '@nx/maven';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/maven` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




## 22.7.x

### `update-0-0-17`
**Version**: 22.7.0-beta.11

Update Maven plugin version from 0.0.16 to 0.0.17 in pom.xml files



## 22.6.x

### `update-0-0-14`
**Version**: 22.6.0-beta.1

Update Maven plugin version from 0.0.13 to 0.0.14 in pom.xml files


### `update-0-0-15`
**Version**: 22.6.0-beta.12

Update Maven plugin version from 0.0.14 to 0.0.15 in pom.xml files


### `update-0-0-16`
**Version**: 22.6.0-beta.14

Update Maven plugin version from 0.0.15 to 0.0.16 in pom.xml files



## 22.5.x

### `update-0-0-13`
**Version**: 22.5.0-beta.4

Update Maven plugin version from 0.0.12 to 0.0.13 in pom.xml files



## 22.4.x

### `update-0-0-12`
**Version**: 22.4.0-beta.0

Update Maven plugin version from 0.0.11 to 0.0.12 in pom.xml files



## 22.2.x

### `update-0-0-11`
**Version**: 22.2.0-beta.4

Update Maven plugin version from 0.0.10 to 0.0.11 in pom.xml files



## 22.1.x

### `update-0.0.8`
**Version**: 22.1.0-beta.4

Update Maven plugin version from 0.0.7 to 0.0.8 in pom.xml files


### `update-0.0.9`
**Version**: 22.1.0-beta.6

Update Maven plugin version from 0.0.8 to 0.0.9 in pom.xml files


### `update-0-0-10`
**Version**: 22.1.0-rc.3

Update Maven plugin version from 0.0.9 to 0.0.10 in pom.xml files


