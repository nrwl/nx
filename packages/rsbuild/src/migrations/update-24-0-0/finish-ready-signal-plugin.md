# Add the Nx ready-signal plugin to the remaining Rsbuild configs

`pluginNxReadySignal()` from `@nx/rsbuild/ready-signal` reports the dev or preview
server's address to Nx once it listens. When a project's Rsbuild config loads it,
`@nx/rsbuild` infers `readyWhen: { "signal": true }` for the `dev` and `preview`
targets. Without it, Nx loads the config when the task runs and waits for the
configured port, which is slower and can pass early when Rsbuild moves to another port.

A generator ran first and added the plugin to every `rsbuild.config.*` it could edit
safely. The advisory context lists the configs it skipped, one per line with the
reason. Those configs are the whole scope: do not re-inventory the workspace and do not
touch configs that are not listed or that already reference `pluginNxReadySignal`. If
the list is empty, make no changes and stop.

## Add the plugin to each listed config

1. Add `import { pluginNxReadySignal } from '@nx/rsbuild/ready-signal';` next to the
   other imports. In a CommonJS config use
   `const { pluginNxReadySignal } = require('@nx/rsbuild/ready-signal');` instead.
2. Add `pluginNxReadySignal()` once to the `plugins` the exported config ends up with.
   - For a config merged from a shared base with `mergeRsbuildConfig` or a spread, first
     check whether the base already loads the plugin. If it does, nothing is missing.
     Otherwise add it to the base when every consumer is an Nx project, else to the
     project's own `plugins`.
   - When `plugins` is a variable, a conditional, or a function result, append the
     plugin to the value that is actually used, keeping every branch.
   - When `defineConfig` receives a function, add the plugin to the returned object.
   - For a file with syntax errors, fix the error only when the intent is obvious,
     then add the plugin. Otherwise report the file instead of guessing.
3. Keep every existing plugin, its options, and the plugin order. Change nothing else.

## Verify

For each project whose config changed, run
`NX_DAEMON=false npx nx show project <project-name> --json` and check that the dev
target's `readyWhen` is `{ "signal": true }`. The preview target gets the same value.
The target names come from the `devTargetName` and `previewTargetName` options of the
`@nx/rsbuild` registration in `nx.json`, `dev` and `preview` by default.

If `readyWhen` still names `@nx/rsbuild/ready-check`, the config does not load the
plugin: check the import path and that the call sits in the `plugins` the exported
config uses. A `readyWhen` set in `targetDefaults` or in the project configuration
replaces the inferred one; leave those alone.

Report the configs you changed and any you could not complete.
