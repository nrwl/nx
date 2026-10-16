# Migrate Next.js config helpers

Remove `withNx` and `composePlugins` from Next.js configurations. Compatibility
exports are inert stubs so old imports do not strand graph creation. Helper behavior was removed in Nx 24. Preserve
application behavior; successful config loading is not proof of equivalence.

## Inspect before changing

Find all `next.config.*` files and imported configuration helpers, including
aliased imports from `@nx/next` and `@nx/next/plugins/with-nx`. Read project targets,
configuration overrides, package scripts, tsconfigs, and workspace package exports.
Record the installed Next version and whether each command uses webpack or
Turbopack. Preserve both; do not switch bundlers or upgrade Next as part of this
migration. Executor conversion is separate: handle explicit and inferred targets
without rewriting target types here.

Record existing output locations, build/serve/export commands, and custom behavior.
Build a baseline before edits if possible; otherwise use an isolated checkout of
the old lockfile. Do not downgrade the working workspace or silently skip validation.

## Unwrap the configuration

Preserve the original export form and Next's config-function contract, including
phase, defaultConfig, async results, and the order of third-party wrappers. Replace
Nx composition with direct composition of the remaining wrappers. Inspect wrapper
APIs rather than assume every wrapper accepts the same arguments or returns an
object. Do not discard custom webpack callbacks or overwrite other wrappers.

Remove the `nx` property from the final Next config only after accounting for every
option it contains. Merely deleting `withNx` does not migrate those options.
`@nx/next:convert-to-inferred` does not finish this job: its existing config rewrite
preserves `withNx` and moves executor options into `nx`.

## Preserve required behavior

Test whether each behavior is needed on this workspace's installed Next version
and existing bundler. Prefer native options. If no native equivalent preserves the
behavior, inline the necessary implementation in a local, user-owned config helper.
The user will maintain that code; do not import Nx's deprecated wrapper or private
implementation as the replacement.

- **Workspace libraries:** verify both tsconfig paths and package-manager workspace
  dependencies, including TypeScript/JSX sources and package exports. Add explicit
  `transpilePackages` entries only where required, merging existing entries. Do not
  assume all workspace libraries are transpiled without configuration.
- **Output paths:** preserve build output and standalone deployment expectations,
  explicit `distDir`, executor `outputPath`, and any `NX_NEXT_OUTPUT_PATH` behavior
  still used by retained executors. Keep development output compatible with the
  existing bundler. Check Nx's declared cache outputs still cover actual files.
- **Static export:** preserve `output: 'export'`, the export destination, and the
  commands that serve it. Do not replace a static export with a server deployment.
- **File replacements/assets:** account for options in both targets and `nx` config.
  Preserve workspace-relative paths, configuration selection, copy destinations,
  and ignores. Use native facilities or inline the required code, then check output.
- **ESM imports:** test `.js` specifiers pointing to TypeScript sources. Keep or
  inline `extensionAlias` only where the installed webpack setup needs it; do not
  assume a webpack option affects Turbopack.
- **CSS/SCSS modules:** test imports from shared libraries under the existing
  bundler. Remove obsolete loader patches only after verifying native support.
- **Babel:** preserve opted-in `babelUpwardRootMode` behavior and custom transforms.
  Inline required webpack behavior if native configuration is insufficient.
- **Legacy lint behavior:** retain the effective build behavior where supported;
  do not emit removed Next options on versions that reject them.

Avoid patches to Next internals when native configuration works. If behavior cannot
be preserved, describe the exact blocker and ask for a decision rather than silently
changing the application.

## Acceptance

Recreate the graph without its disk cache. Run affected builds without task-cache
reuse, relevant tests, production startup/static serving, and dev behavior. Check
shared-library rendering, CSS/SCSS, copied assets, aliases, output locations, and
configuration-specific behavior against the baseline. Use semantic comparisons
where generated hashes differ.

Search configs and imported helpers for remaining Nx wrappers. Already migrated
configs should be unchanged. Report evidence and unresolved differences; never
remove custom behavior or weaken tests to obtain a successful build.
