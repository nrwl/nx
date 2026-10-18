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
 * Registers `@nx/js/typescript` in a workspace where no registration of it
 * infers `typecheck` yet, adding a typecheck-only entry next to an existing
 * unscoped one. Outside TS solution setups it only infers `typecheck`. Callers decide
 * whether inference plugins are in use. Pass `frameworkPlugin` when that
 * plugin still infers `typecheck` for some projects, so its target wins.
 */
export async function ensureTypescriptPlugin(
  tree: Tree,
  updatePackageScripts?: boolean,
  frameworkPlugin?: string
): Promise<void> {
  const nxJson = readNxJson(tree);
  if (nxJson?.plugins?.some(infersTypecheck)) {
    return;
  }
  if (
    nxJson?.plugins?.some(
      (p) =>
        typeof p !== 'string' && p.plugin === '@nx/js/typescript' && !p.include
    )
  ) {
    // `addPlugin` skips workspaces that have an unscoped registration.
    nxJson.plugins.push({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'typecheck' } },
    });
    updateNxJson(tree, nxJson);
  } else if (isUsingTsSolutionSetup(tree)) {
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
    const updated = readNxJson(tree);
    if (moveTypescriptPluginBefore(updated.plugins, frameworkPlugin)) {
      updateNxJson(tree, updated);
    }
  }
}

/**
 * Registers `@nx/js/typescript`, with only its typecheck target, in a
 * workspace where `frameworkPlugin` no longer infers `typecheck`. Reuses the
 * framework plugin's `typecheckTargetName` and a `tsgo` compiler, and skips
 * workspaces where `@nx/js/typescript` already infers it or where
 * `typecheckTargetName` is `false`. With
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
  const typecheckOptions = frameworkRegistrations
    .map(
      (p) =>
        (typeof p === 'string' ? {} : (p.options ?? {})) as {
          typecheckTargetName?: string | false;
          compiler?: string;
        }
    )
    .find((options) => options.typecheckTargetName !== false);
  const targetName = typecheckOptions
    ? (typecheckOptions.typecheckTargetName ?? 'typecheck')
    : undefined;

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

  if (targetName && !nxJson.plugins.some(infersTypecheck)) {
    nxJson.plugins.push({
      plugin: '@nx/js/typescript',
      options: {
        typecheck: { targetName },
        ...(typecheckOptions.compiler === 'tsgo' ? { compiler: 'tsgo' } : {}),
      },
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
  const tsIndex = plugins.findIndex(infersTypecheck);
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

// Scoped build-only registrations, like `@nx/node`'s tsc apps, set `typecheck: false`.
function infersTypecheck(plugin: PluginConfiguration): boolean {
  return (
    getPluginName(plugin) === '@nx/js/typescript' &&
    (typeof plugin === 'string' ||
      (plugin.options as { typecheck?: unknown } | undefined)?.typecheck !==
        false)
  );
}

function getPluginName(plugin: PluginConfiguration): string {
  return typeof plugin === 'string' ? plugin : plugin.plugin;
}
