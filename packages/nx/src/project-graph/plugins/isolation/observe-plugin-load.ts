import { createRequire } from 'node:module';
import { type EnvReads, withEnvReads } from './env-reads';
import { withModuleClosure } from './module-closure';

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
 * measurement reports 1 variable afterwards.
 *
 * What a plugin imports, rather than where Nx keeps it. `@nx/devkit` re-exports
 * `nx/src/devkit-exports` and reads the environment on its own account as well,
 * so naming the inner path alone leaves the wrapper cold. Both are barrels, so
 * this is the surface rather than a list of the modules that happen to read
 * today. A plugin that reaches for Nx without `@nx/devkit` is why the inner
 * paths are here too.
 */
const WARM: readonly string[] = [
  '@nx/devkit',
  '@nx/devkit/internal',
  'nx/src/devkit-exports',
  'nx/src/devkit-internals',
];

/**
 * Resolved from the plugin rather than from here, so what is settled is the copy
 * the plugin is about to import. Resolving from Nx's own directory finds the
 * same files in a flat layout and reaches them only by walking up to the
 * workspace root, which a plugin with its own `node_modules` does not share.
 * Settling a copy the plugin never loads would leave every read on the record.
 *
 * A specifier that fails to resolve is a warming gap and not a broken load, so
 * it costs records their longevity rather than failing the command. A plugin
 * that cannot resolve Nx will not import it either. Anything still unwarmed
 * reads as the plugin's own and only ever means an extra load.
 */
function warmNxModules(specifiers: readonly string[], from: string): void {
  const resolveFromPlugin = createRequire(from);
  for (const specifier of specifiers) {
    try {
      require(resolveFromPlugin.resolve(specifier));
    } catch {}
  }
}

/**
 * Everything a record is checked against: the files the load read and the
 * environment it read them in.
 *
 * One call rather than three, because the order is the whole mechanism and
 * nothing at the call site would show it was wrong. Nx is settled first, so its
 * own import-time reads are not the plugin's. The load is then watched by both
 * observers at once, since what a plugin registers depends on the files it read
 * and on the environment it read them in.
 */
export async function observePluginLoad<T>(
  load: () => Promise<T>,
  pluginPath: string,
  specifiers: readonly string[] = WARM
): Promise<{
  result: T;
  sourceFiles: string[] | null;
  envReads: EnvReads | null;
}> {
  warmNxModules(specifiers, pluginPath);

  const { result, envReads } = await withEnvReads(() =>
    withModuleClosure(load)
  );
  return { result: result.result, sourceFiles: result.sourceFiles, envReads };
}

/** Exported so a spec can check the specifiers still resolve. */
export function nxModulesWarmedBeforeObserving(): readonly string[] {
  return WARM;
}
