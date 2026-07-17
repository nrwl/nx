#### Rewrite `experiments.css: true` for `@rspack/core@2`

`@rspack/core@2` removed `experiments.css` and promoted CSS handling to a
default-available feature — but it's now opt-in **per file type** via
`module.rules`. Workspaces that set `experiments.css: true` on v1 will
silently lose CSS processing on v2 unless `module.rules` declares a rule
matching their CSS file extensions with a `type` of `'css'`, `'css/module'`,
or `'css/auto'`.

This change is workspace-specific (which `test:` regex, which `type:`,
whether existing rules already cover it), so the migration ships as an
AI-assisted instruction rather than a blind codemod.

#### What needs to change

For every `rspack.config.{ts,js,mjs,cjs}` in the workspace that has
`experiments.css: true`:

1. **Delete the `experiments.css: true` line.** If `experiments` becomes
   empty after the deletion, delete the whole `experiments: { ... }`
   property too.

2. **Ensure `module.rules` has a CSS rule using `type: 'css/auto'`** (or
   `'css'` / `'css/module'` if you have a stronger preference). The rspack
   docs recommend `'css/auto'` because it auto-detects CSS Modules
   (filenames matching `*.module.css`).
   - If `module.rules` already has an entry that matches `.css` files —
     for example via `css-loader` / `style-loader` / `MiniCssExtractPlugin`
     — **leave it alone**. The user opted into a loader pipeline on v1 and
     that pipeline still works on v2.

   - If `module.rules` has no CSS-related rule at all, append:

     ```ts
     {
       test: /\.css$/,
       type: 'css/auto',
     }
     ```

3. **Do not touch `experiments.css: false` configs.** Those are handled
   automatically by the deterministic codemod that runs alongside this
   prompt.

#### Sample Code Changes

##### Before

```ts title="apps/myapp/rspack.config.ts" {3-5}
export default {
  // ...
  experiments: {
    css: true,
  },
};
```

##### After

```ts title="apps/myapp/rspack.config.ts" {3-7}
export default {
  // ...
  module: {
    rules: [{ test: /\.css$/, type: 'css/auto' }],
  },
};
```

##### Before — workspace that already uses css-loader

```ts title="apps/myapp/rspack.config.ts" {3-5,7-10}
export default {
  // ...
  experiments: {
    css: true,
  },
  module: {
    rules: [{ test: /\.css$/, use: ['style-loader', 'css-loader'] }],
  },
};
```

##### After — `experiments.css` removed, existing rule untouched

```ts title="apps/myapp/rspack.config.ts"
export default {
  // ...
  module: {
    rules: [{ test: /\.css$/, use: ['style-loader', 'css-loader'] }],
  },
};
```

#### Reference

[`@rspack/core@2` migration guide — Remove experiments.css](https://rspack.rs/guide/migration/rspack_1.x#remove-experimentscss)
