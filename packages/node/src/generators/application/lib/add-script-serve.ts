import {
  type ExpandedPluginConfiguration,
  joinPathFragments,
  readNxJson,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { findMatchingConfigFiles } from '@nx/devkit/internal';
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
  registerScriptPlugin(tree, `@nx/js/${runtime}`, mainFile);
}

function registerScriptPlugin(
  tree: Tree,
  plugin: string,
  mainFile: string
): void {
  const nxJson = readNxJson(tree) ?? {};
  nxJson.plugins ??= [];

  type Registration = ExpandedPluginConfiguration<{ watch?: boolean }>;
  const registrations: Registration[] = nxJson.plugins
    .map((p) => (typeof p === 'string' ? { plugin: p } : p))
    .filter((p): p is Registration => p.plugin === plugin);
  // Later entries take precedence, so the last one that sees the main file
  // decides whether serve watches.
  const last = [...registrations]
    .reverse()
    .find(
      (p) => findMatchingConfigFiles([mainFile], p.include, p.exclude).length
    );
  if (last && last.options?.watch !== false) {
    return;
  }
  // An unscoped entry would undo the user's existing include/exclude or
  // `watch: false`, so scope it to this app's main file in that case.
  nxJson.plugins.push(
    registrations.length ? { plugin, include: [mainFile] } : plugin
  );
  updateNxJson(tree, nxJson);
}
