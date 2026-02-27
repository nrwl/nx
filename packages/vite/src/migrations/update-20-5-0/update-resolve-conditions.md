#### Update `resolve.conditions` to include defaults

In previous Vite versions, the `resolve.conditions` option had defaults that were added internally (i.e. `['module', 'browser', 'development|production']`).  
This default was removed in Vite 6, so this migration adds it to your existing configuration to ensure that the behavior remains intact.

Learn more: [https://vite.dev/guide/migration#default-value-for-resolve-conditions](https://vite.dev/guide/migration#default-value-for-resolve-conditions)

:::note[Remix]
Remix does not currently support Vite 6 and therefore any `vite.config` file for Remix will not be migrated.
:::

#### Sample Code Changes

##### Before

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['require'],
  },
  build: {
    outDir: 'dist',
  },
});
```

##### After

```typescript title="vite.config.ts" {4-6}
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['require', 'module', 'browser', 'development|production'],
  },
  build: {
    outDir: 'dist',
  },
});
```
