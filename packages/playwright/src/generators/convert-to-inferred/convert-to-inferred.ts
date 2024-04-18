import {
  CreateNodesContext,
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  names,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { createNodes, PlaywrightPluginOptions } from '../../plugins/plugin';

interface Schema {
  project?: string;
  all?: boolean;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  await migrateExecutorToPlugin<PlaywrightPluginOptions>(
    tree,
    options,
    projectGraph,
    '@nx/playwright:playwright',
    '@nx/playwright/plugin',
    (targetName) => ({
      targetName,
      ciTargetName: 'e2e-ci',
    }),
    createProjectConfigs,
    createNodes,
    postTargetTransformer
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function createProjectConfigs(
  tree: Tree,
  root: string,
  targetName: string,
  context: CreateNodesContext
) {
  const playwrightConfigPath = ['js', 'ts', 'cjs', 'cts', 'mjs', 'mts']
    .map((ext) => joinPathFragments(root, `playwright.config.${ext}`))
    .find((path) => tree.exists(path));
  if (!playwrightConfigPath) {
    return;
  }

  return createNodes[1](
    playwrightConfigPath,
    {
      targetName,
    },
    context
  );
}

function postTargetTransformer(
  target: TargetConfiguration
): TargetConfiguration {
  if (target.options) {
    if (target.options?.config) {
      delete target.options.config;
    }

    for (const [key, value] of Object.entries(target.options)) {
      const newKeyName = names(key).fileName;
      delete target.options[key];
      target.options[newKeyName] = value;
    }

    if (Object.keys(target.options).length === 0) {
      delete target.options;
    }
  }

  return target;
}

export default convertToInferred;
