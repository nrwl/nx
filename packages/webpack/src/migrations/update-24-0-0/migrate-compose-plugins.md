# Migrate webpack compose helpers

Nx v24 removed `composePlugins`, `composePluginsSync`, `withNx`, `withWeb`, and webpack
`withReact`. Their exports remain as inert stubs so existing configs still load while Nx
builds the project graph. They do not configure builds, and a config that loads is not a
working build.

`@nx/webpack:convert-config-to-webpack-plugin` already ran. The agent context lists the
projects it converted, including configs an earlier conversion left wrapped in
`useLegacyNxPlugin`, and, separately, the projects it could not convert with the reason
for each. Work only on those projects and the files they import. Do not re-inventory the
workspace, and do not run the converter again.

Preserve the installed webpack version, bundler, targets, configurations, and commands.
Nx 24 also removed the `@nx/webpack:webpack` executor. Its targets are converted to inferred
`@nx/webpack/plugin` tasks by a separate migration, so do not add it back or keep a target on it.

## Baseline

This workspace is already on v24, so the old helpers no longer build here. To compare
against the previous behavior, check out the commit before the upgrade in a separate git
worktree, install with its lockfile, and build there. Do not downgrade this workspace. If
you cannot build a baseline, say so in your report rather than calling the comparison a
pass. Record build commands, output locations, assets, entry points, and any observable
custom behavior.

## Projects the converter handled

Each one now has a standard config built around `NxAppWebpackPlugin`, plus a
`useLegacyNxPlugin(require('./webpack.config.old.*'), options)` entry that still loads the
renamed old config. The old config composes its remaining callbacks through a local
`composeLegacyPlugins` helper the converter inlined. Two things are left:

- Move what the old config still does into the new config, then delete the `.old` file and
  drop `useLegacyNxPlugin`.
- `useLegacyNxPlugin` runs at `beforeCompile`. That is too late to register rules, entries,
  or plugins, so anything the old config set through those is already not applying the way
  it used to. Check each one against the baseline instead of trusting the converted build.

Also check the options the converter copied into the new config. It reads them out of the
old `withNx` call as written, so values that depended on the executor or on environment
variables are not represented, and workspace-relative paths may need adjusting: native
plugin options resolve against the project and config directory, while executor options
were workspace-relative.

## Projects the converter skipped

The agent context gives a reason per project. Those configs are untouched and still call
the removed helpers, so rewrite each one.

Use a standard webpack configuration with `NxAppWebpackPlugin` from
`@nx/webpack/app-plugin`. For React apps also use `NxReactWebpackPlugin` from
`@nx/react/webpack-plugin`. Do not add React configuration to Node or plain web apps, and
do not change frameworks or upgrade dependencies to simplify the rewrite.

Map the effective old options onto those plugins and standard webpack properties, reading
the installed plugin types rather than assuming. Preserve precedence between target
options, named configurations, helper options, and custom callbacks. Preserve compiler
choice, aliases, CSS, SVG rules, assets, externals, file replacements, source maps,
optimization, public paths, output filenames, and dev-server behavior. Set output hashing
explicitly where the old helper defaults differ from the plugin defaults; a build that
succeeds with renamed entry files is not output parity.

A `webpackConfig` target option naming a package path rather than a local file, such as
`@nx/react/plugins/webpack`, resolves to the stubs. Give that project its own config file.

Inferred targets run the webpack CLI, which calls a function export with `(env, argv)`.
Represent the options the executor used to supply in the config itself. Use config
functions or separate configs where values vary by configuration.

For custom composable functions, move the function into user-owned code and supply the
options and context it needs explicitly. A local adapter exposing `apply(compiler)` can
work, but an `apply` object belongs in `config.plugins`; exporting it as the whole config
is invalid, and a top-level config function must return a config object or supported array.
Preserve execution order and whether each callback mutates its input or returns a
replacement. Await asynchronous transforms and propagate failures rather than leaving a
pending promise.

## Module Federation

Projects using Nx Module Federation are out of scope here. `@nx/module-federation` ships
its own v24 migration; follow that one. Do not remove federation, disable the project, or
report success for it from this migration.

## Verify and finish

1. Rebuild the project graph without its disk cache and confirm the same projects and
   targets are still discoverable.
2. Run each affected build, development and production and any alternate configurations,
   without reusing cached task outputs. Exercise Node startup where it applies, plus tests
   and dev-server or HMR behavior.
3. Compare emitted files against the baseline: custom assets and markers, entry points,
   aliases, CSS and SVG handling, externals, and output paths. Compare content where hashes
   differ. A zero exit code is not enough.
4. Search the active configs and their imports for the removed helpers again. An already
   migrated config needs no further change.
5. Report the commands you ran, the output you checked, and anything still unresolved. Do
   not delete tests, custom behavior, or targets to get a green result.
