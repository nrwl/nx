import { addPlugin } from '@nx/devkit/internal';
import {
  createProjectGraphAsync,
  readNxJson,
  updateNxJson,
  type PluginConfiguration,
  type Tree,
} from '@nx/devkit';
import { createNodesV2 } from '../../plugins/typescript/plugin';
import { isUsingTsSolutionSetup } from './ts-solution-setup';

export async function addTypescriptPlugin(
  tree: Tree,
  updatePackageScripts?: boolean
): Promise<void> {
  await addPlugin(
    tree,
    await createProjectGraphAsync(),
    '@nx/js/typescript',
    createNodesV2,
    {
      typecheck: [
        { targetName: 'typecheck' },
        { targetName: 'tsc:typecheck' },
        { targetName: 'tsc-typecheck' },
      ],
      build: [
        {
          targetName: 'build',
          configName: 'tsconfig.lib.json',
          buildDepsName: 'build-deps',
          watchDepsName: 'watch-deps',
        },
        {
          targetName: 'tsc:build',
          configName: 'tsconfig.lib.json',
          buildDepsName: 'tsc:build-deps',
          watchDepsName: 'tsc:watch-deps',
        },
        {
          targetName: 'tsc-build',
          configName: 'tsconfig.lib.json',
          buildDepsName: 'tsc-build-deps',
          watchDepsName: 'tsc-watch-deps',
        },
      ],
    },
    updatePackageScripts
  );
}

/**
 * Registers `@nx/js/typescript` in a TS solution workspace that has no
 * registration of it yet. Callers decide whether inference plugins are in use.
 */
export async function ensureTypescriptPluginForTsSolution(
  tree: Tree,
  updatePackageScripts?: boolean
): Promise<void> {
  if (!isUsingTsSolutionSetup(tree)) {
    return;
  }
  const isRegistered = readNxJson(tree)?.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/js/typescript'
      : p.plugin === '@nx/js/typescript'
  );
  if (isRegistered) {
    return;
  }
  await addTypescriptPlugin(tree, updatePackageScripts);
}

/**
 * Registers `@nx/js/typescript`, with only its typecheck target, in a TS
 * solution workspace where `frameworkPlugin` no longer infers `typecheck`.
 * Reuses the framework plugin's `typecheckTargetName`, and skips workspaces
 * that already register `@nx/js/typescript` or set it to `false`. Returns
 * whether nx.json changed.
 */
export function registerTypescriptPluginForTypecheck(
  tree: Tree,
  frameworkPlugin: string
): boolean {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins?.length || !isUsingTsSolutionSetup(tree)) {
    return false;
  }
  if (nxJson.plugins.some((p) => getPluginName(p) === '@nx/js/typescript')) {
    return false;
  }

  const targetName = nxJson.plugins
    .filter((p) => getPluginName(p) === frameworkPlugin)
    .map((p) =>
      typeof p === 'string'
        ? 'typecheck'
        : ((p.options as { typecheckTargetName?: string | false } | undefined)
            ?.typecheckTargetName ?? 'typecheck')
    )
    .find((name): name is string => name !== false);
  if (!targetName) {
    return false;
  }

  nxJson.plugins.push({
    plugin: '@nx/js/typescript',
    options: { typecheck: { targetName } },
  });
  updateNxJson(tree, nxJson);
  return true;
}

function getPluginName(plugin: PluginConfiguration): string {
  return typeof plugin === 'string' ? plugin : plugin.plugin;
}
