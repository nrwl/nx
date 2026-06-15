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
