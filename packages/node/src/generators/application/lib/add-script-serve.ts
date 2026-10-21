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
  registerScriptPlugin(
    tree,
    `@nx/js/${runtime}`,
    mainFile,
    // Written later by addProject.
    joinPathFragments(
      options.appProjectRoot,
      options.useProjectJson ? 'project.json' : 'package.json'
    )
  );
}

function registerScriptPlugin(
  tree: Tree,
  plugin: string,
  mainFile: string,
  marker: string
): void {
  const nxJson = readNxJson(tree) ?? {};
  nxJson.plugins ??= [];

  type Registration = ExpandedPluginConfiguration<{ watch?: boolean }>;
  const registrations: Registration[] = nxJson.plugins
    .map((p) => (typeof p === 'string' ? { plugin: p } : p))
    .filter((p): p is Registration => p.plugin === plugin);
  // The plugin finds projects through the markers it is handed, so an entry
  // covers the app only when it sees the main file and the marker. Later
  // entries take precedence, so the last one that covers it decides whether
  // serve watches.
  const last = [...registrations]
    .reverse()
    .find(
      (p) =>
        findMatchingConfigFiles([mainFile, marker], p.include, p.exclude)
          .length === 2
    );
  if (last && last.options?.watch !== false) {
    return;
  }
  // An unscoped entry would undo the user's existing include/exclude or
  // `watch: false`, so scope it to this app in that case.
  nxJson.plugins.push(
    registrations.length ? { plugin, include: [marker, mainFile] } : plugin
  );
  updateNxJson(tree, nxJson);
}
