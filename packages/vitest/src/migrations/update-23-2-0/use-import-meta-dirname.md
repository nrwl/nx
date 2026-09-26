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

No migration renames an existing config to `.mts`, because other tooling may reference it by path. So a workspace whose config is `.ts` keeps the companion warning about ESM syntax in a CommonJS-loaded file. Rename it yourself, or set `"type": "module"` in the closest `package.json`, to clear that one. Newly generated configs use `.mts` and are unaffected.

One generated case does put `import.meta.dirname` in a `.ts` config: `@nx/nuxt` falls back to `.ts` on workspaces still using eslintrc, because the legacy `@nuxt/eslint-config` cannot parse `.mts`. Vite's default config loader bundles that file, so it works today, but the file is not loadable under `configLoader: 'native'` - its own `import` statements already make it so.
