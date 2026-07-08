#### Pin the Inferred `rootDir` for TypeScript 6

Before TypeScript 6, a tsconfig that did not set `rootDir` had it inferred as the common directory of the program's non-declaration input files. TypeScript 6 changed that default to the tsconfig's own directory. A program whose files resolve outside that directory (most commonly a spec or e2e tsconfig that imports another project's source through a `paths` alias) now hard-fails with `TS5011` or `TS6059` because a file falls outside the assumed root.

For every project `tsconfig*.json` that does not already set `rootDir` (directly or through `extends`), this migration pins `rootDir` to exactly the directory TypeScript 5 would have inferred, so both compilation and emit layout stay the same under TypeScript 6. The value is computed by the TypeScript compiler itself, so it matches `tsc` exactly, including project-reference redirects. The pin is written even when the inferred directory already equals the tsconfig directory: inference is per-program, and a tool that compiles a subset of the config's files — ts-jest with `isolatedModules` builds a program per test file — re-infers a deeper common directory from that subset and fails with `TS5011`. Configs that cannot hit the error are skipped: ones without an output option (`outDir`, `outFile`, `sourceRoot`, `mapRoot`, or `declaration` + `declarationDir`), ones with no input files, and composite projects (whose `rootDir` defaults to the tsconfig directory in both versions, for any file subset). The migration only runs when the workspace is on TypeScript 6.

Each config is updated on its own; the migration never writes `rootDir` to a shared `extends` base, so a config never inherits a value computed for a sibling. The one case that needs care is a config that both needs a `rootDir` and is itself an `extends` base: a composite child would inherit the new value and emit to the wrong place, so each such child is pinned to its own directory to keep the default it had.

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
