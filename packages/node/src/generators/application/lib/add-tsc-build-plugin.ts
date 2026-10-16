import {
  type ExpandedPluginConfiguration,
  readNxJson,
  type Tree,
  updateNxJson,
} from '@nx/devkit';

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

  const registration = nxJson.plugins.find(
    (p) =>
      typeof p !== 'string' &&
      p.plugin === tsPlugin &&
      (p.options as TscAppBuildOptions)?.build?.configName ===
        appBuildConfigName
  ) as ExpandedPluginConfiguration | undefined;

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
  } else if (registration.include && !registration.include.includes(pattern)) {
    registration.include.push(pattern);
  }

  updateNxJson(tree, nxJson);
  // A reused registration may name the target something other than `build`.
  return (
    (registration?.options as TscAppBuildOptions)?.build?.targetName ?? 'build'
  );
}
