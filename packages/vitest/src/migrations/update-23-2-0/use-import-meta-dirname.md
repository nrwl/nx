#### Replace `__dirname` with `import.meta.dirname` in Vite config files

Vite 8 warns when a config uses features that its `configLoader: 'native'` mode cannot support, and `__dirname` is one of them:

```
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - `__dirname` (packages/utils/vitest.config.mts:4:9). Use `import.meta.dirname` instead
```

This migration rewrites `__dirname` to `import.meta.dirname` in every `vite.config.mts`, `vite.config.mjs`, `vitest.config.mts`, and `vitest.config.mjs` file in your workspace.

#### Sample Code Changes

##### Before

```ts
export default defineConfig(() => ({
  root: __dirname,
}));
```

##### After

```ts
export default defineConfig(() => ({
  root: import.meta.dirname,
}));
```

#### What is not rewritten

`.ts` and `.js` configs are left alone, since those extensions can still be loaded as CommonJS, where `import.meta` is a syntax error. Configs that declare their own `__dirname` (usually `const __dirname = path.dirname(fileURLToPath(import.meta.url))`) are also left alone - that idiom already works under the native config loader.
