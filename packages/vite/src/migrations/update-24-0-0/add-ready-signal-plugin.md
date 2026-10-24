#### Add the `nxReadySignal()` plugin to Vite configs

`@nx/vite/plugin` infers `readyWhen: { signal: true }` for the dev and preview targets of a project whose Vite config loads the `nxReadySignal()` plugin. The plugin reports the server's address to Nx once it listens, so a task that depends on the server with `waitFor: 'ready'` starts when the server accepts requests. Without the plugin, the inferred check resolves the config when the task runs and waits for the configured port, which can pass early when Vite moves to another port.

This migration adds the import and `nxReadySignal()` to the `plugins` of the `vite.config.{ts,mts,cts,js,mjs,cjs}` file in each project root. It skips `vitest.config.*` files, `projectType: 'library'` projects, configs with `build.lib` and no `server` options, and configs that already load the plugin. It edits a config that exports a plain object, with or without `defineConfig`, and a factory that returns one, such as `defineConfig(() => ({ ... }))` or a function body with a single `return`. A config it can't edit safely, such as a `mergeConfig` call, a config imported from a shared base, or a `plugins` array that spreads plugins from elsewhere, is left alone and listed. In agentic runs, an AI prompt finishes those configs.

#### Sample code changes

##### Before

```ts title="apps/myapp/vite.config.ts"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  root: import.meta.dirname,
  plugins: [react()],
}));
```

##### After

```ts title="apps/myapp/vite.config.ts"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  plugins: [react(), nxReadySignal()],
}));
```
