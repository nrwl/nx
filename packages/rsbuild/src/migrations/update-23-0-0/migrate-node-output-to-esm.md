#### Make Node-target rsbuild builds runnable under `@rsbuild/core@2`

`@rsbuild/core@2` changed the default output format for Node targets. In v1,
`output.target: 'node'` produced **minified CommonJS**. In v2 it produces
**unminified ESM** (`output.module` defaults to `true`, `output.minify` to
`false`).

A v2 ESM bundle does not run as plain `node dist/index.js` unless one of the
following is true:

- a `package.json` with `"type": "module"` governs the output, **or**
- the output files use the `.mjs` extension.

Without one of those, the build succeeds but the process crashes at runtime
with `Cannot use import statement outside a module`.

This is workspace-specific — it depends on whether the project owns a
`package.json`, what runs or references the bundle (a `main` field, a
Dockerfile, a deploy script, a `serve` target), and whether other `.js`
files in the project are CommonJS. So it ships as an AI-assisted
instruction rather than a blind codemod.

#### What needs to change

For every project with an `rsbuild.config.{ts,js,mjs,cjs}` whose
`output.target` is `'node'`:

1. **Decide how the ESM output should be made runnable.** Prefer, in order:
   - **The project owns its own `package.json`** → set `"type": "module"`
     on it. This is rsbuild's recommended convention. Check first that no
     sibling `.js` files in the project rely on CommonJS (`require`,
     `module.exports`, `__dirname`); if any do, rename them to `.cjs` or
     convert them to ESM.

   - **The project has no `package.json`** → add `.mjs` output to the
     rsbuild config instead, so the output is ESM regardless of any
     ancestor `package.json`:

     ```ts title="rsbuild.config.ts"
     export default defineConfig({
       output: {
         target: 'node',
         filename: { js: '[name].mjs' },
       },
     });
     ```

2. **Update anything that references the output filename.** If you chose
   `.mjs`, fix references in `package.json#main`, Dockerfiles, `serve`
   targets, deploy scripts, and any `import`/`require` of the built file.

3. **Do not pin back to CommonJS** unless the project genuinely cannot move
   to ESM. If you must, restore the v1 behavior explicitly:

   ```ts title="rsbuild.config.ts"
   export default defineConfig({
     output: {
       target: 'node',
       module: false,
       minify: true,
     },
   });
   ```

#### Sample Code Changes

##### Before — Node project, no project package.json

```ts title="apps/api/rsbuild.config.ts" {4}
export default defineConfig({
  output: {
    target: 'node',
    distPath: { root: 'dist' },
  },
});
```

##### After — `.mjs` output so the ESM bundle runs

```ts title="apps/api/rsbuild.config.ts" {4}
export default defineConfig({
  output: {
    target: 'node',
    filename: { js: '[name].mjs' },
    distPath: { root: 'dist' },
  },
});
```

#### Reference

[`@rsbuild/core` v1 → v2 upgrade guide — Node output](https://rsbuild.rs/guide/upgrade/v1-to-v2#node-output)
