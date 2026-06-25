#### Set isolatedModules for ts-jest below TypeScript 6

The jest 30 path of `@nx/jest` bumps ts-jest to 29.4.x.
On the CommonJS jest path, ts-jest 29.2+ uses `moduleResolution: node10` when `bundler` is invalid alongside the forced `module: commonjs`, which is the case below TypeScript 6.
`node10` does not read package `exports` maps, so a workspace library that exposes types only through `exports` fails to resolve during the ts-jest type check:

```text
error TS2307: Cannot find module '@my-org/some-lib' or its corresponding type declarations.
```

The migration sets `isolatedModules: true` in each affected `tsconfig.spec.json`, so ts-jest transpiles each file independently and skips the cross-file type resolution that was failing.
This matches the `isolatedModules: true` that fresh ts-solution workspaces already set in `tsconfig.base.json`.
Type checking stays on each project's dedicated typecheck target.

The migration runs only below TypeScript 6, in ts-solution workspaces that do not already enable `isolatedModules`.
TypeScript 6 and above resolves `exports` under `bundler` with `commonjs`, so those workspaces are left unchanged.

#### Sample code changes

##### Before

```json title="tsconfig.spec.json"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["jest", "node"]
  }
}
```

##### After

```json title="tsconfig.spec.json" {4}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "isolatedModules": true,
    "types": ["jest", "node"]
  }
}
```

#### Verifying the workspace

After the migration runs, verify the workspace still typechecks and fix anything `isolatedModules` surfaced:

```bash
nx run-many -t typecheck
```

`isolatedModules` can fail typecheck (TS1205 - re-exporting a type needs `export type`; TS2748 - const enum access) or break a project's tests at runtime even when typecheck passes. The cause is a package that re-exports a value through both `module.exports` and an ESM `export` (for example napi bindings exposing a `const enum`); per-file transpilation cannot preserve it, and consumers of that const enum break too. To fix a broken project, remove `isolatedModules` from its `tsconfig.spec.json`; if that brings back the `TS2307: Cannot find module` error this migration was added to prevent, that project needs `isolatedModules`, so fix the source instead.
