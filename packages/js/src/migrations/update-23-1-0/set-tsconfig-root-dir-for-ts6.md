#### Pin the Inferred `rootDir` for TypeScript 6

Before TypeScript 6, a tsconfig that did not set `rootDir` had it inferred as the common directory of the program's non-declaration input files. TypeScript 6 changed that default to the tsconfig's own directory. A program whose files resolve outside that directory - most commonly a spec or e2e tsconfig that imports another project's source through a `paths` alias - now hard-fails with `TS5011` or `TS6059` because a file falls outside the assumed root.

For every project `tsconfig*.json` that does not already set `rootDir` (directly or through `extends`), this migration pins `rootDir` to exactly the directory TypeScript 5 would have inferred, so both compilation and emit layout stay the same under TypeScript 6. The value is computed by the TypeScript compiler itself, so it matches `tsc` exactly, including project-reference redirects. Configs that cannot hit the error are skipped: ones without an output option (`outDir`, `outFile`, `sourceRoot`, `mapRoot`, or `declaration` + `declarationDir`), ones with no input files, and ones whose inferred directory already equals the tsconfig directory. The migration only runs when the workspace is on TypeScript 6.

To keep the change small, when several configs that extend the same project-local base all need the identical `rootDir`, it is written once to that base and inherited. This only happens when every config extending the base agrees on the value or is unaffected by it; otherwise each config is updated on its own.

#### Sample Code Changes

##### Before

A `libs/products/e2e/tsconfig.json` whose specs import a shared library's source:

```json title="libs/products/e2e/tsconfig.json"
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc"
  },
  "include": ["src/**/*.ts"]
}
```

##### After

```json title="libs/products/e2e/tsconfig.json" {4}
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "../../..",
    "outDir": "../../../dist/out-tsc"
  },
  "include": ["src/**/*.ts"]
}
```
