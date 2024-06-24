import {
  createProjectGraphAsync,
  formatFiles,
  names,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { createNodesV2, PlaywrightPluginOptions } from '../../plugins/plugin';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';

interface Schema {
  project?: string;
  all?: boolean;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migratedProjects =
    await migrateExecutorToPlugin<PlaywrightPluginOptions>(
      tree,
      projectGraph,
      '@nx/playwright:playwright',
      '@nx/playwright/plugin',
      (targetName) => ({ targetName, ciTargetName: 'e2e-ci' }),
      postTargetTransformer,
      createNodesV2,
      options.project
    );

  if (migratedProjects.size === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function postTargetTransformer(
  target: TargetConfiguration
): TargetConfiguration {
  if (target.options) {
    if (target.options?.config) {
      delete target.options.config;
    }

    handleRenameOfProperties(target.options);
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      handleRenameOfProperties(configuration);
    }
  }

  return target;
}

function handleRenameOfProperties(options: Record<string, unknown>) {
  for (const [key, value] of Object.entries(options)) {
    const newKeyName = names(key).fileName;
    delete options[key];
    options[newKeyName] = value;
  }
}

export default convertToInferred;
