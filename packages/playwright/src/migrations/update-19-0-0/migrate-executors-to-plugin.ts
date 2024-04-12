import {
  createProjectGraphAsync,
  joinPathFragments,
  readNxJson,
  type TargetConfiguration,
  type Tree,
  updateProjectConfiguration,
  updateNxJson,
  formatFiles,
  glob,
  readProjectConfiguration,
} from '@nx/devkit';
import {
  addPluginWithPreferredTargetNames,
  deleteMatchingProperties,
  getProjectsToMigrate,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { mergeTargetConfigurations } from 'nx/src/project-graph/utils/project-configuration-utils';
import { type RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import {
  createNodes,
  type PlaywrightPluginOptions,
} from '../../plugins/plugin';

const defaultPluginOptions = {
  targetName: 'e2e',
  ciTargetName: 'e2e-ci',
};

export default async function migrateExecutorsToPlugin(tree: Tree) {
  const projectGraph = await createProjectGraphAsync();
  let nxJsonConfiguration = readNxJson(tree);

  const { projects, targetName } = getProjectsToMigrate(
    tree,
    '@nx/playwright:playwright'
  );
  const targetDefaultsForExecutor =
    nxJsonConfiguration.targetDefaults?.['@nx/playwright:playwright'];

  const configFiles = glob(tree, [createNodes[0]]);
  for (const projectName of projects) {
    const projectFromGraph = projectGraph.nodes[projectName];
    const playwrightConfigPath = ['js', 'ts', 'cjs', 'cts', 'mjs', 'mts']
      .map((ext) =>
        joinPathFragments(
          projectFromGraph.data.root,
          `playwright.config.${ext}`
        )
      )
      .find((path) => tree.exists(path));
    if (!playwrightConfigPath) {
      continue;
    }

    const { projects } = await createNodes[1](
      playwrightConfigPath,
      {
        targetName,
        ciTargetName: 'e2e-ci',
      },
      {
        workspaceRoot: tree.root,
        nxJsonConfiguration,
        configFiles,
      }
    );

    const createdProject = Object.entries(projects ?? {}).find(
      ([root]) => root === projectFromGraph.data.root
    )[1];

    const createdTarget: TargetConfiguration<RunCommandsOptions> =
      createdProject.targets[targetName];
    delete createdTarget.command;
    delete createdTarget.options?.cwd;

    const projectConfig = readProjectConfiguration(tree, projectName);
    let target = projectConfig.targets[targetName];

    target = mergeTargetConfigurations(target, targetDefaultsForExecutor);
    delete target.executor;
    delete target.options?.config;

    deleteMatchingProperties(target, createdTarget);

    if (Object.keys(target).length > 0) {
      projectConfig.targets[targetName] = target;
    } else {
      delete projectConfig.targets[targetName];
    }
    updateProjectConfiguration(tree, projectName, projectConfig);
  }

  nxJsonConfiguration =
    addPluginWithPreferredTargetNames<PlaywrightPluginOptions>(
      '@nx/playwright/plugin',
      { targetName, ciTargetName: defaultPluginOptions.ciTargetName },
      defaultPluginOptions,
      nxJsonConfiguration
    );
  updateNxJson(tree, nxJsonConfiguration);

  await formatFiles(tree);
}
