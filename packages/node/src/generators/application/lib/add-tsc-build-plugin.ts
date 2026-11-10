import {
  type ExpandedPluginConfiguration,
  joinPathFragments,
  readNxJson,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { findMatchingConfigFiles } from '@nx/devkit/internal';

const tsPlugin = '@nx/js/typescript';
const appBuildConfigName = 'tsconfig.app.json';

type TscAppBuildOptions =
  | { build?: { configName?: string; targetName?: string } }
  | undefined;

/**
 * Infers a tsc `build` target for the app from its tsconfig.app.json. A shared
 * registration scoped by `include` keeps other apps that have a
 * tsconfig.app.json (vite, webpack, ...) from getting a tsc build too.
 * Returns the name of the inferred build target.
 */
export function addTscAppBuildPlugin(tree: Tree, projectRoot: string): string {
  const nxJson = readNxJson(tree) ?? {};
  nxJson.plugins ??= [];
  // `./*` matches nothing for a root project.
  const pattern = projectRoot === '.' ? '*' : `${projectRoot}/*`;

  const configFile = joinPathFragments(projectRoot, appBuildConfigName);

  const registrations = nxJson.plugins.filter(
    (p): p is ExpandedPluginConfiguration =>
      typeof p !== 'string' &&
      p.plugin === tsPlugin &&
      (p.options as TscAppBuildOptions)?.build?.configName ===
        appBuildConfigName
  );
  // An `exclude` can hide the app from a registration that lists it.
  let registration = registrations.find(
    (p) => findMatchingConfigFiles([configFile], p.include, p.exclude).length
  );
  if (!registration) {
    registration = registrations.find((p) => p.include && !p.exclude);
    registration?.include.push(pattern);
  }

  if (!registration) {
    nxJson.plugins.push({
      plugin: tsPlugin,
      include: [pattern],
      options: {
        typecheck: false,
        build: {
          targetName: 'build',
          configName: appBuildConfigName,
          buildDepsName: 'build-deps',
          watchDepsName: 'watch-deps',
          skipBuildCheck: true,
        },
      },
    });
  }

  updateNxJson(tree, nxJson);
  // A reused registration may name the target something other than `build`.
  return (
    (registration?.options as TscAppBuildOptions)?.build?.targetName ?? 'build'
  );
}
