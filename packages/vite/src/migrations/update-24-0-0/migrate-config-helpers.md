# Migrate Vite config helpers

Replace `nxViteTsPaths` and `nxCopyAssetsPlugin`. Their imports remain available for
compatibility only. Helper behavior was removed in Nx 24; the stubs do not configure builds. Preserve installed Vite versions, bundlers, commands,
and executor/inferred target choices. Do not upgrade Vite merely to simplify this
migration; executor conversion is separate.

## Inventory and baseline

Find Vite and Vitest configurations (`.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`),
imported config factories, aliased helper imports, and configuration-specific target
options. Inspect each config's root, workspace tsconfigs and references, package
exports, helper options, assets, build output, and modes.

Record build/test/serve commands and baseline output. If the currently installed
packages cannot build the old config, use a separate checkout with the prior
lockfile. Do not downgrade the workspace or describe untested output as equivalent.

## Paths resolution

A codemod ran first, but only on workspaces with Vite 8 or newer installed. Where
it ran it removed `nxViteTsPaths` from `vite.config.*` and `vitest.config.*` and
set `resolve.tsconfigPaths: true`. It dropped any `buildLibsFromSource` option
the helper carried, because native resolution has no equivalent; if a project
relied on building library dependencies instead of resolving their source,
restore that through the dependency's `package.json` entry points.

Confirm the codemod's edits, then handle everything it left: every config if the
installed Vite is older than 8, and otherwise helper imports under an alias,
calls outside a plugins array, configs assembled by a factory with branching
returns, and config files named something else.

Check the installed Vite version's types/docs for native `resolve.tsconfigPaths`.
Verify the relevant source files are included by the intended tsconfig and that
inherited paths/references are resolved. Preserve existing `resolve` options.

Where native support is unavailable or does not preserve the required behavior,
use a compatible `vite-tsconfig-paths` version. Check its peer dependencies and
module format against the installed Vite/Node versions before adding it to the
workspace's dependencies. Preserve CJS/ESM loading; use a supported async import
when needed instead of requiring an ESM-only package from CommonJS.

Map any custom `nxViteTsPaths` options deliberately. Test actual alias imports and
workspace packages, including exports and buildable-library behavior. Do not
assume `vite-tsconfig-paths` reproduces Nx's package fallback/remapping logic or
that TypeScript's editor resolution proves Vite runtime resolution. Check Vitest
separately if it shares or imports the config. Keep unrelated plugins and their order.

## Asset copying

Use `publicDir` only for a single directory copied unchanged to the expected output
root, with equivalent serving behavior. Do not move a user's source assets merely
to fit that option.

For globs, multiple sources/destinations, or assets outside the project, use a
compatible `vite-plugin-static-copy` version or a local Vite plugin where necessary.
Inspect the installed replacement's options instead of assuming a one-to-one map.

For every string pattern or `{ input, glob, output, ignore }` entry:

- Resolve the original source using the old plugin's actual project/workspace root
  semantics. Resolve replacement paths against the Vite root. Include sibling libs.
- Preserve output-relative subdirectories and filenames; do not flatten directories
  or accidentally add another source-directory segment.
- Preserve excludes and glob behavior. Translate ignores using syntax supported by
  the selected replacement version and verify excluded files are absent after a
  completed build. Do not simply drop `ignore`.
- Preserve any existing public directory and collision/overwrite behavior.
- Verify serving/watch updates as well as production copying. Check copied files
  exist before downstream tasks consume the completed build output.

Remove old helper imports/calls after preserving their behavior. Leave unrelated
configuration and installed framework versions alone.

## Acceptance

1. Recreate the project graph without disk-cache reuse and verify required targets.
2. Run affected builds and tests without task-cache reuse.
3. Compare output file paths and asset bytes with the baseline; confirm expected
   excludes after build completion. Verify alias imports execute/render correctly.
4. Start the existing dev command on an available user-approved port. Load the app
   and asset, edit a source asset, confirm the served update, then restore it and
   stop the server. Never infer watch behavior from a successful production build.
5. Search imported configs for deprecated helpers. Already migrated configs should
   need no edits. Report checks and unresolved behavior; do not weaken assertions,
   remove targets, or discard user assets to make the migration pass.
