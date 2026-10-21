For an overview of the plugin and setup instructions, see the [@nx/rollup introduction](/docs/technologies/build-tools/rollup/introduction).

The @nx/rollup plugin provides various migrations to help you migrate to newer versions of rollup projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-23-0-0-remove-use-legacy-typescript-plugin`
**Version**: 23.0.0-beta.4

Remove deprecated useLegacyTypescriptPlugin option from @nx/rollup:rollup

#### Remove the `useLegacyTypescriptPlugin` Option from the `@nx/rollup:rollup` Executor

Removes the deprecated `useLegacyTypescriptPlugin` option from the `@nx/rollup:rollup` executor. The legacy TypeScript plugin support has been dropped; the option no longer has any effect. The migration removes it from project configuration, target defaults in `nx.json`, and `rollup.config.*` files that pass it to `withNx`.

#### Sample Code Changes

Remove `useLegacyTypescriptPlugin` from the `@nx/rollup:rollup` executor options in project configuration.

##### Before

```json title="libs/my-lib/project.json" {8}
{
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib",
        "useLegacyTypescriptPlugin": true
      }
    }
  }
}
```

##### After

```json title="libs/my-lib/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib"
      }
    }
  }
}
```

Remove `useLegacyTypescriptPlugin` from the `@nx/rollup:rollup` executor target defaults in `nx.json`.

##### Before

```json title="nx.json" {7}
{
  "targetDefaults": {
    "@nx/rollup:rollup": {
      "options": {
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "useLegacyTypescriptPlugin": true
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/rollup:rollup": {
      "options": {
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json"
      }
    }
  }
}
```

Remove `useLegacyTypescriptPlugin` from `withNx` calls in `rollup.config.*` files.

##### Before

```js title="libs/my-lib/rollup.config.cjs" {7}
const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx({
  outputPath: '../../dist/libs/my-lib',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  format: ['cjs', 'esm'],
  useLegacyTypescriptPlugin: true,
});
```

##### After

```js title="libs/my-lib/rollup.config.cjs"
const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx({
  outputPath: '../../dist/libs/my-lib',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  format: ['cjs', 'esm'],
});
```



### `rewrite-rollup-internal-subpath-imports`
**Version**: 23.0.0-beta.24

Rewrites `@nx/rollup/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/rollup`'s exports map. Named imports/exports of public symbols are routed to `@nx/rollup` and the rest to the new `@nx/rollup/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/rollup/internal`.


### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/rollup/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/rollup` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/rollup/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/rollup/plugin';
```

##### After

```ts
import { createNodes } from '@nx/rollup/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/rollup/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-package-updates
**Version**: 23.0.0-beta.24


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `rollup` | `^4.14.0` | Added if not installed


