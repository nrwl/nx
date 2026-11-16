# Add the nxReadySignal() Vite plugin to the remaining configs

Nx 24 infers `readyWhen: { signal: true }` for the dev and preview targets of a Vite project whose config loads the `nxReadySignal()` plugin from `@nx/vite/plugins/nx-ready-signal.plugin`. Without it, Nx falls back to a task-time port check that can pass before the server is up. A codemod already added the plugin to every config it could edit safely. The advisory context lists the configs it skipped, each with the reason.

Before changing anything, check for leftover work: the advisory context names at least one config. If it names none, make no changes and stop. Do not re-inventory the workspace; treat each listed config as pending work and leave every other file alone.

1. In each listed config, add `import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';` (or the `require` form in a CommonJS config) and `nxReadySignal()` to the plugins Vite loads for it. Put it where the plugins are assembled: the shared base config, the object passed to `mergeConfig`, or each branch of a conditional array. Add it once; plugins that already include it, for example through a shared base, need no edit. Preserve the existing plugins, their order, and any custom behavior.
2. Run `nx show project <name> --json` for each affected project and confirm that the dev (or serve) and preview targets report `"readyWhen": { "signal": true }`. `@nx/vite/plugin` infers it once the config loads the plugin. A `readyWhen` with a `command` that requires `@nx/vite/ready-check` instead means the resolved config does not include the plugin yet.
3. Report the configs you edited and any you could not. An unresolved config means the migration is incomplete.
