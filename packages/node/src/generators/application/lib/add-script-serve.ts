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
  includeAppInScriptPlugin(
    tree,
    `@nx/js/${runtime}`,
    options.appProjectRoot,
    mainFile,
    // Written later by addProject.
    joinPathFragments(
      options.appProjectRoot,
      options.useProjectJson ? 'project.json' : 'package.json'
    )
  );
}

/**
 * Scopes the plugin to each app's main file and project marker; unscoped, it
 * would sniff every js/ts file in the workspace.
 */
function includeAppInScriptPlugin(
  tree: Tree,
  plugin: string,
  projectRoot: string,
  mainFile: string,
  marker: string
): void {
  const nxJson = readNxJson(tree) ?? {};
  nxJson.plugins ??= [];
  const files = '{package.json,project.json,src/main.{ts,js}}';
  const pattern = projectRoot === '.' ? files : `${projectRoot}/${files}`;

  type Registration = ExpandedPluginConfiguration<{ watch?: boolean }>;
  const registrations: Registration[] = nxJson.plugins
    .map((p) => (typeof p === 'string' ? { plugin: p } : p))
    .filter((p): p is Registration => p.plugin === plugin);
  const matchesMain = (p: Registration) =>
    findMatchingConfigFiles([mainFile], p.include, p.exclude).length === 1;
  const covers = (p: Registration) =>
    findMatchingConfigFiles([mainFile, marker], p.include, p.exclude).length ===
    2;
  const isScopedWatch = (p: Registration) =>
    p.options?.watch === true && !!p.include && !p.exclude;

  // The generated serve target must watch for changes. Keep its watch-enabled
  // plugin entry after other main-file matches so a later entry cannot disable watch.
  const last = registrations.map(matchesMain).lastIndexOf(true);
  if (
    last !== -1 &&
    registrations[last].options?.watch === true &&
    covers(registrations[last])
  ) {
    return;
  }
  const scoped = registrations.slice(last + 1).find(isScopedWatch);
  if (scoped) {
    scoped.include.push(pattern);
  } else {
    nxJson.plugins.push({
      plugin,
      include: [pattern],
      options: { watch: true },
    });
  }
  updateNxJson(tree, nxJson);
}
