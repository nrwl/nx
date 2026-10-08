import { addPlugin } from '@nx/devkit/internal';
import { createProjectGraphAsync, readNxJson, type Tree } from '@nx/devkit';
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
