import {
  createProjectGraphAsync,
  joinPathFragments,
  readNxJson,
  TargetConfiguration,
  type NxJsonConfiguration,
  type ProjectGraph,
  type Tree,
  updateProjectConfiguration,
  updateNxJson,
  formatFiles,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { PlaywrightPluginOptions } from '../../plugins/plugin';

const executors = {
  e2e: '@nx/playwright:playwright',
};

const defaultOptionsForExecutors = {
  e2e: (projectRoot: string) => ({
    cache: true,
    dependsOn: ['^build'],
    inputs: ['production', '^production'],
    executor: '@nx/playwright:playwright',
    outputs: [
      joinPathFragments('{workspaceRoot}', 'dist', '.playwright', projectRoot),
    ],
    options: {
      config: joinPathFragments(projectRoot, 'playwright.config.ts'),
    },
  }),
};

const defaultPluginOptions = {
  targetName: 'e2e',
  ciTargetName: 'e2e-ci',
};

function getProjectsAndTargetToMigrate(
  tree: Tree,
  nxJson: NxJsonConfiguration,
  playwrightProjectNames: Record<string, Set<string>>,
  targetNameCounts: Record<keyof typeof executors, Record<string, number>>
) {
  for (const targetExecutor of Object.keys(executors)) {
    forEachExecutorOptions(
      tree,
      executors[targetExecutor],
      (targetOptions, projectName, targetName) => {
        if (!(projectName in playwrightProjectNames)) {
          playwrightProjectNames[projectName] = new Set();
        }
        playwrightProjectNames[projectName].add(targetName);

        targetNameCounts[targetExecutor][targetName] =
          targetName in targetNameCounts[targetExecutor]
            ? targetNameCounts[targetExecutor][targetName] + 1
            : 1;
      }
    );
  }
}

/**
 * Create a key-value pair of options that need to be migrated to the build target in project.json
 * @param nxJson NxJsonConfiguration
 */
function getTargetDefaultOptionsToAddToProject(
  nxJson: NxJsonConfiguration
): Record<string, any> {
  let canMigrateBuildExecutor = true;
  let targetDefaultOptions: Record<string, any> = {};
  if (nxJson.targetDefaults) {
    if (
      executors.e2e in nxJson.targetDefaults &&
      nxJson.targetDefaults[executors.e2e].options
    ) {
      const targetDefaultConfigKeys = Object.keys(
        nxJson.targetDefaults[executors.e2e].options
      );
      // the options are migratable, list them in key-value pair
      // to be added to the build target on the project.json
      targetDefaultOptions = targetDefaultConfigKeys.reduce(
        (opts, key) => ({
          ...opts,
          [key]: nxJson.targetDefaults[executors.e2e].options[key],
        }),
        targetDefaultOptions
      );
    }
  }
  return targetDefaultOptions;
}

function getPreferredTargetName(
  targetNameCounts: Record<keyof typeof executors, Record<string, number>>
) {
  const targetNames = Object.keys(targetNameCounts.e2e);
  let preferredTargetName = targetNames[0] ?? defaultPluginOptions.targetName;
  if (targetNames.length > 1) {
    preferredTargetName = targetNames.reduce(
      (preferredName, currentName) =>
        targetNameCounts.e2e[preferredName] >= targetNameCounts.e2e[currentName]
          ? preferredName
          : currentName,
      preferredTargetName
    );
  }
  return { preferredTargetName };
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

function migrateE2ETarget(
  tree: Tree,
  projectGraph: ProjectGraph,
  targetNames: Set<string>,
  preferredTargetName: string,
  projectName: string,
  projectTargets: Record<string, TargetConfiguration>,
  updatedProject: boolean,
  targetDefaultOptionsToMigrate: Record<string, any>
) {
  if (targetNames.has(preferredTargetName)) {
    const defaultOptions = defaultOptionsForExecutors.e2e(
      projectGraph.nodes[projectName].data.root
    );
    let currentTargetOptions = projectTargets[preferredTargetName];

    currentTargetOptions = {
      // current target options exist in the project.json, and would override targetDefaults
      ...currentTargetOptions,
      options: {
        ...targetDefaultOptionsToMigrate,
        ...(currentTargetOptions.options ?? {}),
      },
    };

    deleteMatchingProperties(currentTargetOptions, defaultOptions);
    delete projectTargets[preferredTargetName].executor;

    if (Object.values(currentTargetOptions).length === 0) {
      delete projectTargets[preferredTargetName];
    } else {
      projectTargets[preferredTargetName] = currentTargetOptions;
    }

    updatedProject = true;
  }
  return updatedProject;
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
  const nxJson = readNxJson(tree);

  const playwrightProjectNames: Record<string, Set<string>> = {};

  const targetNameCounts: Record<
    keyof typeof executors,
    Record<string, number>
  > = {
    e2e: {},
  };

  const targetDefaultOptionsToMigrate =
    getTargetDefaultOptionsToAddToProject(nxJson);

  getProjectsAndTargetToMigrate(
    tree,
    nxJson,
    playwrightProjectNames,
    targetNameCounts
  );

  const { preferredTargetName } = getPreferredTargetName(targetNameCounts);

  for (const [projectName, targetNames] of Object.entries(
    playwrightProjectNames
  )) {
    const projectTargets = projectGraph.nodes[projectName].data.targets;

    let updatedProject = false;

    updatedProject = migrateE2ETarget(
      tree,
      projectGraph,
      targetNames,
      preferredTargetName,
      projectName,
      projectTargets,
      updatedProject,
      targetDefaultOptionsToMigrate
    );

    if (updatedProject) {
      updateProjectConfiguration(tree, projectName, {
        ...projectGraph.nodes[projectName].data,
        targets: projectTargets,
      });
    }
  }

  addPlugin(tree, preferredTargetName);

  await formatFiles(tree);
}
