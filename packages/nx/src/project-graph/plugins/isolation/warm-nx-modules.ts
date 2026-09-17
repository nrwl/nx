import { withEnvReads } from './env-reads';

/**
 * Nx's own surface, loaded before a plugin's load is observed.
 *
 * Nx reads the environment at import time, for its terminal, its cloud client
 * and its CI detection, and a plugin that imports `@nx/devkit` reaches all of
 * it. Observed cold, loading `@nx/jest`'s plugin reports 29 variables, among
 * them `NX_TUI`, `CI`, `GITHUB_ACTIONS` and `NX_CLOUD_ACCESS_TOKEN`. None of
 * them decides what the plugin registers, and Nx rewrites `NX_TUI` per command
 * while CI sets the rest differently from a laptop, so a record naming them
 * would miss on the next command of a different shape and never hold across
 * machines.
 *
 * Settling them first leaves only what the plugin's own code read. The same
 * measurement reports 2 variables afterwards. Both entries are barrels, so this
 * is the surface rather than a list of the modules that happen to read today.
 */
const WARM: readonly string[] = [
  '../../../devkit-exports',
  '../../../devkit-internals',
];

/**
 * A specifier that fails to resolve is a warming gap and not a broken load, so
 * it costs records their longevity rather than failing the command. Anything
 * still unwarmed reads as the plugin's own and only ever means an extra load.
 */
function warmNxModules(specifiers: readonly string[]): void {
  for (const specifier of specifiers) {
    try {
      require(specifier);
    } catch {}
  }
}

/**
 * Observes a plugin's load, warming Nx first.
 *
 * One call rather than two, because the order is the whole point and a caller
 * that warmed afterwards would look right and record everything.
 */
export function observePluginLoad<T>(
  load: () => Promise<T>,
  specifiers: readonly string[] = WARM
): ReturnType<typeof withEnvReads<T>> {
  warmNxModules(specifiers);
  return withEnvReads(load);
}

/** Exported so a spec can check the specifiers still resolve. */
export function nxModulesWarmedBeforeObserving(): readonly string[] {
  return WARM;
}
