# Verify typecheck after the Nx 23.1 migration

This migration enables `isolatedModules` on ts-jest spec configs. Run
`nx run-many -t typecheck` and fix any project it broke.

`isolatedModules` can fail typecheck (TS1205 - a re-exported type needs `export type`;
TS2748 - const enum access) or break a project's tests at runtime. To fix a broken
project, remove `isolatedModules` from its `tsconfig.spec.json` and re-run. If a
`TS2307: Cannot find module` error then appears for a workspace library, that project
needs `isolatedModules` - keep it and fix the source instead (avoid mixing
`module.exports` with an ESM `export`, and avoid cross-file `const enum`).

Re-run until the projects this migration touched typecheck. See the migration
documentation for details.
