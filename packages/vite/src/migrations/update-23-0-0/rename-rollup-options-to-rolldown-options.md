#### Rename `rollupOptions` to `rolldownOptions` in Vite Config Files

Renames the `rollupOptions` property to `rolldownOptions` inside `vite.config.{js,ts,mjs,mts,cjs,cts}` files. [Vite 8 replaced Rollup with Rolldown](https://vite.dev/blog/announcing-vite8) as its production bundler; `rollupOptions` is accepted as a deprecated alias but logs a warning and may produce precedence surprises when both keys are present. The migration covers top-level usage as well as nested `environments.<env>.build.rollupOptions`.

The migration only touches files matching `vite.*config*.{js,ts,mjs,mts,cjs,cts}`. Helper modules imported by your config and `rollupOptions` declared elsewhere need to be renamed by hand.

#### Sample Code Changes

Top-level rename inside `build`.

##### Before

```ts title="apps/myapp/vite.config.ts" {3}
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['react'],
    },
  },
});
```

##### After

```ts title="apps/myapp/vite.config.ts"
export default defineConfig({
  build: {
    rolldownOptions: {
      external: ['react'],
    },
  },
});
```

The same rename applies inside `environments.<env>.build`.

##### Before

```ts title="apps/myapp/vite.config.ts" {5}
export default defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: { external: ['fs'] },
      },
    },
  },
});
```

##### After

```ts title="apps/myapp/vite.config.ts"
export default defineConfig({
  environments: {
    ssr: {
      build: {
        rolldownOptions: { external: ['fs'] },
      },
    },
  },
});
```

> **Note**: Rolldown is largely Rollup-compatible but a handful of options have different semantics. The most common one to check after this migration: `output.manualChunks` only accepts a function in Rolldown (the object-of-globs form is invalid). See `tools/ai-migrations/MIGRATE_VITE_8.md` (created by a sibling migration) for the full Vite 8 upgrade checklist.
