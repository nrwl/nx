import {
  createProjectGraphAsync,
  joinPathFragments,
  readNxJson,
  TargetConfiguration,
  type Tree,
  updateProjectConfiguration,
  updateNxJson,
  formatFiles,
  glob,
  readProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { createNodes, PlaywrightPluginOptions } from '../../plugins/plugin';
import { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import { mergeTargetConfigurations } from 'nx/src/project-graph/utils/project-configuration-utils';

const defaultPluginOptions = {
  targetName: 'e2e',
  ciTargetName: 'e2e-ci',
};

function getProjectsToMigrate(tree: Tree, executor: string) {
  const allProjectsWithExecutor = new Map<string, Set<string>>();
  const targetCounts = new Map<string, number>();

  forEachExecutorOptions(
    tree,
    executor,
    (_, projectName, targetName, configurationName) => {
      if (configurationName) {
        return;
      }

      if (allProjectsWithExecutor.has(projectName)) {
        allProjectsWithExecutor.get(projectName).add(targetName);
      } else {
        allProjectsWithExecutor.set(projectName, new Set([targetName]));
      }

      if (targetCounts.has(targetName)) {
        targetCounts.set(targetName, targetCounts.get(targetName) + 1);
      } else {
        targetCounts.set(targetName, 1);
      }
    }
  );

  let preferredTargetName: string = Array.from(targetCounts.keys())[0];
  for (const [targetName, count] of targetCounts) {
    if (count > targetCounts.get(preferredTargetName)) {
      preferredTargetName = targetName;
    }
  }

  const projects = Array.from(allProjectsWithExecutor)
    .filter(([_, targets]) => {
      return targets.has(preferredTargetName);
    })
    .map(([projectName, _]) => projectName);

  return {
    projects,
    targetName: preferredTargetName,
  };
}

function deleteMatchingProperties(
  currentTarget: TargetConfiguration,
  defaultTarget: TargetConfiguration
) {
  for (const key in currentTarget) {
    if (Array.isArray(currentTarget[key])) {
      if (
        currentTarget[key].every((v) => defaultTarget[key].includes(v)) &&
        currentTarget[key].length === defaultTarget[key].length
      ) {
        delete currentTarget[key];
      }
    } else if (
      typeof currentTarget[key] === 'object' &&
      typeof defaultTarget[key] === 'object'
    ) {
      deleteMatchingProperties(currentTarget[key], defaultTarget[key]);
    } else if (currentTarget[key] === defaultTarget[key]) {
      delete currentTarget[key];
    }
    if (
      typeof currentTarget[key] === 'object' &&
      Object.keys(currentTarget[key]).length === 0
    ) {
      delete currentTarget[key];
    }
  }
}

/**
 * Add the plugin to nx.json using the preferred target names
 * @param tree Virtual Tree
 * @param preferredE2ETargetName The most common target name using the e2e executor
 */
function addPlugin(tree: Tree, preferredE2ETargetName: string) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  let addNewPluginEntry = true;
  for (let i = 0; i < nxJson.plugins.length; i++) {
    const plugin = nxJson.plugins[i];
    if (
      typeof plugin === 'string' &&
      plugin === '@nx/playwright/plugin' &&
      preferredE2ETargetName === defaultPluginOptions.targetName
    ) {
      addNewPluginEntry = false;
    } else if (
      typeof plugin === 'object' &&
      plugin.plugin === '@nx/playwright/plugin'
    ) {
      const pluginOptions: PlaywrightPluginOptions = plugin.options;
      if (
        !pluginOptions &&
        preferredE2ETargetName === defaultPluginOptions.targetName
      ) {
        addNewPluginEntry = false;
      } else if (
        (pluginOptions.targetName &&
          pluginOptions.targetName === preferredE2ETargetName) ||
        (!pluginOptions.targetName &&
          preferredE2ETargetName === defaultPluginOptions.targetName)
      ) {
        addNewPluginEntry = false;
      }
    }
  }

  if (addNewPluginEntry) {
    nxJson.plugins.push({
      plugin: '@nx/playwright/plugin',
      options: {
        targetName: preferredE2ETargetName,
        ciTargetName: defaultPluginOptions.ciTargetName,
      },
    });

    updateNxJson(tree, nxJson);
  }
}

export default async function migrateExecutorsToPlugin(tree: Tree) {
  const projectGraph = await createProjectGraphAsync();
  const nxJsonConfiguration = readNxJson(tree);

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

  addPlugin(tree, targetName);

  await formatFiles(tree);
}
