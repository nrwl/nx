import {
  type TargetConfiguration,
  type Tree,
  CreateNodesContext,
  formatFiles,
  joinPathFragments,
  names,
  createProjectGraphAsync,
} from '@nx/devkit';
import {
  addPluginWithOptions,
  getProjectsToMigrate,
  migrateExecutorToPlugin as _migrateExecutorToPlugin,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import {
  createNodes,
  type PlaywrightPluginOptions,
} from '../../../plugins/plugin';
import {} from '@nx/devkit';

export async function migrateExecutorToPlugin(
  tree: Tree,
  projectName?: string,
  projectRoot?: string
) {
  const projectGraph = await createProjectGraphAsync();
  const { allProjectsWithExecutor } = getProjectsToMigrate(
    tree,
    '@nx/playwright:playwright'
  );

  if (projectName && !allProjectsWithExecutor.has(projectName)) {
    throw new Error(
      `Project "${projectName}" does not use "@nx/playwright:playwright executor. Please select a project that does."`
    );
  }

  if (projectName) {
    allProjectsWithExecutor.clear();
    allProjectsWithExecutor.add(projectName);
  }

  while (allProjectsWithExecutor.size !== 0) {
    const { targetName, include, migratedProjects } =
      await _migrateExecutorToPlugin(
        tree,
        projectGraph,
        createProjectConfigs(projectRoot),
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
}

function createProjectConfigs(onlyProjectRoot?: string) {
  return (
    tree: Tree,
    root: string,
    targetName: string,
    context: CreateNodesContext
  ) => {
    if (onlyProjectRoot && root !== onlyProjectRoot) {
      return;
    }

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
  };
}

function projectOptionsTransformer(
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
  }

  return target;
}
