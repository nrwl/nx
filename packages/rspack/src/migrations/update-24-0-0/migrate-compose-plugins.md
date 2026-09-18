# Migrate rspack compose helpers

Migrate this workspace off `composePlugins`, `composePluginsSync`, `withNx`,
`withWeb`, and rspack `withReact`. Their exports remain available for migration
compatibility only. Helper behavior was removed in Nx 24; the stubs do not configure builds. Config loading alone does not prove a working build.

## Scope and inventory

- Preserve the installed rspack version, bundler, targets, configurations, and
  commands. Executor conversion is a separate migration. Handle both existing
  executors and targets already using rspack CLI.
- Find all rspack configs, including `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, `.mts`,
  alternate production/development files, imported helpers, and `.old` configs.
  Trace aliased imports and re-exports of the deprecated helpers.
- Read each project's target options and configuration overrides. Record which
  values come from `withNx`/`withWeb`/`withReact`, the executor, environment
  variables, and custom callbacks. Include Node/Nest apps and multi-config builds.
- Record existing build commands, output locations, assets, entry points, and
  observable custom behavior. Build a baseline if the current packages still
  support it. If not, use an isolated checkout with the prior lockfile; do not
  downgrade this workspace or call a missing baseline a pass.

## Replace the built-in helpers

Use a standard rspack configuration with `NxAppRspackPlugin` from
`@nx/rspack/app-plugin`. For React apps also use `NxReactRspackPlugin` from
`@nx/rspack/react-plugin`. Do not add React configuration to Node or plain web
apps. Do not change frameworks or upgrade dependencies to simplify the rewrite.

Map the effective old options to these plugins and standard rspack properties.
Inspect the installed plugin options/types. Preserve precedence between target
options, named configurations, helper options, and custom callbacks. Pay attention
to paths: executor paths are often workspace-relative, while native plugin options
and rspack CLI resolve relative to the project/config working directory. Preserve
compiler choice, aliases, CSS, SVG rules, assets, externals, file replacements,
source maps, optimization, public paths, output filenames, and dev-server behavior.
Set output hashing explicitly where old helper defaults differ from native plugin
defaults; a successful build with renamed entry files is not output parity.

When keeping `@nx/rspack:rspack`, set `standardRspackConfigFunction: true` when
using the native plugin classes, including for object exports. Despite its name,
the flag also bypasses legacy entry validation that otherwise runs before
`NxAppRspackPlugin` applies and fails with "Entry is required". For function
exports it also selects standard invocation instead of Nx callback context.
Preserve explicit target configuration options.
For CLI targets, explicitly represent options previously supplied by the executor.
Use config functions or separate configs where configuration-dependent values vary.

`@nx/rspack:convert-config-to-rspack-plugin` can provide a starting point, but it
retains `rspack.config.old.*` through `useLegacyNxPlugin`. It also rejects some
Node/Nest, multi-config, and Module Federation setups. Do not run it blindly or
consider its output a finished migration. `convert-to-inferred` is not this task.

## Preserve custom composition

Move ordinary configuration changes into the standard config. Preserve execution
order and whether callbacks mutate their input or return a replacement. For custom
composable functions, a local adapter exposing `apply(compiler)` may be suitable.
Move the function into user-owned code and explicitly supply any options/context
it requires; do not leave it dependent on removed executors or the old Nx helpers.

An `apply` object belongs in `config.plugins`; exporting it as the whole rspack
config is invalid. A top-level config function must return a config object (or
supported config array), not a plugin.

Do not treat adapters as equivalent by default. Rspack processes some options
before plugin hooks run. Adding a plugin to `compiler.options.plugins` after
initialization does not apply that plugin. `useLegacyNxPlugin` runs at
`beforeCompile`, which can be too late for rules, entries, or plugin registration.
Prefer config-time transformations; apply nested plugins explicitly and at the
correct stage if adapting is necessary. Await asynchronous config transforms and
propagate failures rather than leaving a pending promise.

For Module Federation, preserve the existing topology and custom behavior. Follow
any separately supplied MF migration instructions. If no compatible replacement
exists in the installed packages, report the exact remaining dependency; do not
remove federation, disable the project, or claim migration success.

## Verify and finish

1. Rebuild the project graph without using its existing disk cache. Confirm the
   same projects and required targets are still discoverable.
2. Run each affected build, including development/production and alternate
   configs, without reusing cached task outputs. Exercise Node/Nest startup where
   applicable, plus tests and relevant dev-server/HMR behavior.
3. Inspect emitted files and behavior against the baseline: custom assets and
   markers, entry points, aliases, CSS/SVG behavior, externals, and output paths.
   Compare semantic content where hashes differ. A zero exit code is insufficient.
4. Search active configs and their imported modules again. Remove obsolete imports
   and stop loading old configs only after preserving their behavior. Keep unrelated
   changes out of the diff. Already migrated configs should need no further changes.
5. Report commands run, output checks, and unresolved differences. Fix failures;
   never delete tests, custom behavior, or targets merely to get a green result.
