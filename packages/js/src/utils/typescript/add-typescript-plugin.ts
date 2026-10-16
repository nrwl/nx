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
      typecheck: TYPECHECK_OPTIONS,
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

const TYPECHECK_OPTIONS = [
  { targetName: 'typecheck' },
  { targetName: 'tsc:typecheck' },
  { targetName: 'tsc-typecheck' },
];

/**
 * Registers `@nx/js/typescript` in a workspace that has no registration of it
 * yet. Outside TS solution setups it only infers `typecheck`. Callers decide
 * whether inference plugins are in use. Pass `frameworkPlugin` when that
 * plugin still infers `typecheck` for some projects, so its target wins.
 */
export async function ensureTypescriptPlugin(
  tree: Tree,
  updatePackageScripts?: boolean,
  frameworkPlugin?: string
): Promise<void> {
  const isRegistered = readNxJson(tree)?.plugins?.some(
    (p) => getPluginName(p) === '@nx/js/typescript'
  );
  if (isRegistered) {
    return;
  }
  if (isUsingTsSolutionSetup(tree)) {
    await addTypescriptPlugin(tree, updatePackageScripts);
  } else {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/js/typescript',
      createNodesV2,
      { typecheck: TYPECHECK_OPTIONS },
      updatePackageScripts
    );
  }
  if (frameworkPlugin) {
    const nxJson = readNxJson(tree);
    if (moveTypescriptPluginBefore(nxJson.plugins, frameworkPlugin)) {
      updateNxJson(tree, nxJson);
    }
  }
}

/**
 * Registers `@nx/js/typescript`, with only its typecheck target, in a
 * workspace where `frameworkPlugin` no longer infers `typecheck`. Reuses the
 * framework plugin's `typecheckTargetName`, and skips workspaces that already
 * register `@nx/js/typescript` or set it to `false`. With
 * `removeTypecheckTargetName`, the option is also dropped from the framework
 * plugin's registrations. Returns whether nx.json changed.
 */
export function registerTypescriptPluginForTypecheck(
  tree: Tree,
  frameworkPlugin: string,
  { removeTypecheckTargetName = false } = {}
): boolean {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins?.length) {
    return false;
  }

  const frameworkRegistrations = nxJson.plugins.filter(
    (p) => getPluginName(p) === frameworkPlugin
  );
  const targetName = frameworkRegistrations
    .map((p) =>
      typeof p === 'string'
        ? 'typecheck'
        : ((p.options as { typecheckTargetName?: string | false } | undefined)
            ?.typecheckTargetName ?? 'typecheck')
    )
    .find((name): name is string => name !== false);

  let changed = false;
  if (removeTypecheckTargetName) {
    for (const p of frameworkRegistrations) {
      const options =
        typeof p === 'string'
          ? undefined
          : (p.options as Record<string, unknown> | undefined);
      if (options && 'typecheckTargetName' in options) {
        delete options['typecheckTargetName'];
        changed = true;
      }
    }
  }

  if (
    targetName &&
    !nxJson.plugins.some((p) => getPluginName(p) === '@nx/js/typescript')
  ) {
    nxJson.plugins.push({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName } },
    });
    moveTypescriptPluginBefore(nxJson.plugins, frameworkPlugin);
    changed = true;
  }

  if (changed) {
    updateNxJson(tree, nxJson);
  }
  return changed;
}

/**
 * Plugins registered later override same-named targets, so `@nx/js/typescript`
 * goes before a framework plugin that still infers `typecheck`.
 */
function moveTypescriptPluginBefore(
  plugins: PluginConfiguration[],
  frameworkPlugin: string
): boolean {
  const tsIndex = plugins.findIndex(
    (p) => getPluginName(p) === '@nx/js/typescript'
  );
  const frameworkIndex = plugins.findIndex(
    (p) => getPluginName(p) === frameworkPlugin
  );
  if (tsIndex === -1 || frameworkIndex === -1 || tsIndex < frameworkIndex) {
    return false;
  }
  const [tsPlugin] = plugins.splice(tsIndex, 1);
  plugins.splice(frameworkIndex, 0, tsPlugin);
  return true;
}

function getPluginName(plugin: PluginConfiguration): string {
  return typeof plugin === 'string' ? plugin : plugin.plugin;
}
