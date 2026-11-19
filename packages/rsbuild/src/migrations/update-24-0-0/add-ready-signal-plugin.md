#### Add the Nx ready-signal plugin to Rsbuild configs

The `dev` and `preview` targets that `@nx/rsbuild` infers carry a `readyWhen` check, so a dependent task can wait until the server accepts requests. With `pluginNxReadySignal()` in the Rsbuild config, the server reports its address to Nx as soon as it listens, and the targets are inferred with `readyWhen: { "signal": true }`. Without it, Nx loads the config when the task runs and waits for the configured port instead.

New configs include the plugin. This migration adds it to each project's existing `rsbuild.config.{ts,mts,cts,js,mjs,cjs}` when the file calls `defineConfig` once with an object literal, or a function with a single `return` of one, whose `plugins` option is missing or a literal array. Configs that already reference the plugin are left alone.

Configs the migration can't edit safely stay untouched and are listed with the reason. That includes CommonJS modules, `mergeRsbuildConfig`, a spread into the config or its `plugins` array, a `plugins` value that isn't an array literal, a config factory without a single top-level `return`, and files with syntax errors. In an agentic run, an AI step adds the plugin to those.

#### Sample code changes

##### Before

```ts title="apps/app1/rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    port: 4200,
  },
});
```

##### After

```ts title="apps/app1/rsbuild.config.ts"
import { pluginNxReadySignal } from '@nx/rsbuild/ready-signal';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact(), pluginNxReadySignal()],
  server: {
    port: 4200,
  },
});
```
