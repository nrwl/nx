import {
  joinPathFragments,
  readNxJson,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';

/**
 * Prepends a shebang and target name to the main file so @nx/js/node or
 * @nx/js/tsx infers `serve` as `node --watch` / `tsx watch` on it.
 */
export function addScriptServe(tree: Tree, options: NormalizedSchema): void {
  const runtime = options.serveRuntime;
  const mainFile = joinPathFragments(
    options.appProjectRoot,
    'src',
    options.js ? 'main.js' : 'main.ts'
  );
  const header = `#!/usr/bin/env ${runtime}\n// @nx-target-name: serve\n`;
  tree.write(mainFile, header + tree.read(mainFile, 'utf-8'));
  registerScriptPlugin(tree, `@nx/js/${runtime}`);
}

/** Registers the plugin once; an existing entry, however scoped, is the user's. */
function registerScriptPlugin(tree: Tree, plugin: string): void {
  const nxJson = readNxJson(tree) ?? {};
  nxJson.plugins ??= [];
  if (
    nxJson.plugins.some(
      (p) => (typeof p === 'string' ? p : p.plugin) === plugin
    )
  ) {
    return;
  }
  nxJson.plugins.push(plugin);
  updateNxJson(tree, nxJson);
}
