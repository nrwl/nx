import {
  CreateNodesContext,
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  names,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  addPluginWithOptions,
  getProjectsToMigrate,
  migrateExecutorToPlugin,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import {
  createNodes,
  type PlaywrightPluginOptions,
} from '../../plugins/plugin';

export default async function migrateExecutorsToPlugin(tree: Tree) {
  const projectGraph = await createProjectGraphAsync();
  const { allProjectsWithExecutor } = getProjectsToMigrate(
    tree,
    '@nx/playwright:playwright'
  );

  while (allProjectsWithExecutor.size !== 0) {
    const { targetName, include, migratedProjects } =
      await migrateExecutorToPlugin(
        tree,
        projectGraph,
        createProjectConfigs,
        '@nx/playwright:playwright',
        createNodes,
        projectOptionsTransformer
      );

    addPluginWithOptions<PlaywrightPluginOptions>(
      tree,
      '@nx/playwright/plugin',
      include,
      { targetName, ciTargetName: 'e2e-ci' }
    );

    for (const project of migratedProjects) {
      allProjectsWithExecutor.delete(project);
    }
  }

  await formatFiles(tree);
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

function projectOptionsTransformer(
  target: TargetConfiguration
): TargetConfiguration {
  if (target.options) {
    for (const [key, value] of Object.entries(target.options)) {
      const newKeyName = names(key).fileName;
      delete target.options[key];
      target.options[newKeyName] = value;
    }
  }

  return target;
}
