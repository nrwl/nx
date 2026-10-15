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

  // Only registrations with `watch` infer a continuous serve.
  const registrations = nxJson.plugins.filter(
    (p): p is ExpandedPluginConfiguration<{ watch?: boolean }> =>
      typeof p !== 'string' &&
      p.plugin === plugin &&
      (p.options as { watch?: boolean })?.watch === true
  );
  const covers = (p: (typeof registrations)[number]) =>
    findMatchingConfigFiles([mainFile, marker], p.include, p.exclude).length ===
    2;
  if (registrations.some(covers)) {
    return;
  }
  const scoped = registrations.find((p) => !!p.include && !p.exclude);
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
