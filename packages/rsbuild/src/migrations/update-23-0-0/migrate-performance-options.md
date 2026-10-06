#### Migrate `performance` options for `@rsbuild/core@2`

`@rsbuild/core@2` removed two `performance` options and deprecated a third.
rsbuild v2 does not hard-error on the stale keys — it warns and ignores the
removed ones, and the deprecated one still works — so the changes here are
about adopting the replacements rather than fixing a broken build. None
have a drop-in key rename, so this ships as an AI-assisted instruction.

This only affects projects whose `rsbuild.config.{ts,js,mjs,cjs}` sets one
of the options below. If none of your configs use them, there is nothing
to do.

#### `performance.bundleAnalyze` was removed

rsbuild v1 bundled `webpack-bundle-analyzer` and exposed it through
`performance.bundleAnalyze`. v2 removed it to cut install size.

For every config that sets `performance.bundleAnalyze`, remove that option
and pick one replacement:

- **Preferred — Rsdoctor.** Add the [Rsdoctor](https://rsdoctor.dev) plugin;
  it covers bundle-size analysis and more. See
  [rsbuild.rs/guide/debug/rsdoctor](https://rsbuild.rs/guide/debug/rsdoctor).

- **Keep webpack-bundle-analyzer.** Install it and register it via
  `tools.rspack`:

  ```ts title="rsbuild.config.ts"
  import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

  export default {
    tools: {
      rspack: {
        plugins: [new BundleAnalyzerPlugin({ analyzerMode: 'static' })],
      },
    },
  };
  ```

If `performance` is left empty after removing the option, delete the empty
`performance: {}` block too.

#### `performance.profile` was removed

`performance.profile` emitted an rspack stats JSON file. v2 removed it; emit
the file from a small custom plugin instead.

For every config that sets `performance.profile: true`, remove that option
and add:

```ts title="rsbuild.config.ts"
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const statsJsonPlugin = {
  name: 'stats-json-plugin',
  setup(api) {
    api.onAfterBuild(({ stats }) => {
      writeFileSync(
        join(api.context.distPath, 'stats.json'),
        JSON.stringify(stats?.toJson({}), null, 2)
      );
    });
  },
};

export default {
  plugins: [statsJsonPlugin],
};
```

#### `performance.chunkSplit` is deprecated

`performance.chunkSplit` still works in v2 but is deprecated. Migrate it to
the new top-level `splitChunks` option, which aligns with Rspack's
`optimization.splitChunks`.

For every config that sets `performance.chunkSplit`, translate `strategy`:

| `chunkSplit.strategy`                        | `splitChunks` replacement                       |
| -------------------------------------------- | ----------------------------------------------- |
| `split-by-experience`                        | `{ preset: 'default' }`                         |
| `split-by-module`                            | `{ preset: 'per-package' }`                     |
| `single-vendor`                              | `{ preset: 'single-vendor' }`                   |
| `all-in-one`                                 | `false` (chunk splitting disabled)              |
| `custom` (with a nested `splitChunks`)       | `{ preset: 'none', ...the nested splitChunks }` |
| `split-by-size` (with `minSize` / `maxSize`) | `{ preset: 'none', minSize, maxSize }`          |

Then translate the remaining `chunkSplit` keys:

- `override` → spread its contents directly into the top-level `splitChunks`.
- `forceSplitting` → `splitChunks.cacheGroups`. Each `forceSplitting` entry
  `name: <RegExp>` expands to a full cache group:

  ```ts
  cacheGroups: {
    <name>: {
      test: <RegExp>,
      name: '<name>',
      chunks: 'all',
      // priority 0 normally; use 1 when the `single-vendor` preset is set
      priority: 0,
      enforce: true,
    },
  }
  ```

##### `forceSplitting` example

```diff title="rsbuild.config.ts"
export default {
-  performance: {
-    chunkSplit: {
-      forceSplitting: {
-        axios: /node_modules[\\/]axios/,
-      },
-    },
-  },
+  splitChunks: {
+    cacheGroups: {
+      axios: {
+        test: /node_modules[\\/]axios/,
+        name: 'axios',
+        chunks: 'all',
+        priority: 0,
+        enforce: true,
+      },
+    },
+  },
};
```

If `performance` is empty after removing `chunkSplit`, delete the empty
`performance: {}` block.

#### Sample Code Changes

##### Before

```ts title="apps/web/rsbuild.config.ts" {3-5}
export default defineConfig({
  performance: {
    bundleAnalyze: {},
    profile: true,
  },
});
```

##### After

```ts title="apps/web/rsbuild.config.ts"
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

const statsJsonPlugin = {
  name: 'stats-json-plugin',
  setup(api) {
    api.onAfterBuild(({ stats }) => {
      writeFileSync(
        join(api.context.distPath, 'stats.json'),
        JSON.stringify(stats?.toJson({}), null, 2)
      );
    });
  },
};

export default defineConfig({
  plugins: [statsJsonPlugin],
  tools: {
    rspack: {
      plugins: [new BundleAnalyzerPlugin({ analyzerMode: 'static' })],
    },
  },
});
```

#### Reference

- [`@rsbuild/core` v1 → v2 upgrade guide — Remove `performance.bundleAnalyze`](https://rsbuild.rs/guide/upgrade/v1-to-v2#remove-performancebundleanalyze)
- [`@rsbuild/core` v1 → v2 upgrade guide — Remove `performance.profile`](https://rsbuild.rs/guide/upgrade/v1-to-v2#remove-performanceprofile)
- [`@rsbuild/core` v1 → v2 upgrade guide — Migrate `performance.chunkSplit`](https://rsbuild.rs/guide/upgrade/v1-to-v2#migrate-performancechunksplit)
