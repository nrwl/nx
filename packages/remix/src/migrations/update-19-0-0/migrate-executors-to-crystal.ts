import {
  type NxJsonConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
  type Tree,
  createProjectGraphAsync,
  getPackageManagerCommand,
  joinPathFragments,
  offsetFromRoot,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { type RemixPluginOptions } from '../../plugins/plugin';
import { tsquery } from '@phenomnomnominal/tsquery';

const executors = {
  build: '@nx/remix:build',
  serve: '@nx/remix:serve',
};

const defaultOptionsForExecutors = {
  build: (projectRoot: string) => ({
    cache: true,
    dependsOn: ['^build'],
    inputs: ['production', '^production'],
    executor: '@nx/remix:build',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: joinPathFragments('dist', projectRoot),
    },
  }),
  serve: {
    executor: `@nx/remix:serve`,
    options: {
      command: `${getPackageManagerCommand().exec} remix-serve build/index.js`,
      manual: true,
      port: 3000,
    },
  },
};

const defaultCrystalPluginOptions = {
  buildTargetName: 'build',
  devTargetName: 'dev',
  startTargetName: 'start',
  typecheckTargetName: 'typecheck',
};

const nonMigratableOptions = {
  build: [
    'includeDevDependenciesInPackageJson',
    'generatePackageJson',
    'generateLockfile',
  ],
};

export default async function migrateExecutorsToCrystal(tree: Tree) {
  const projectGraph = await createProjectGraphAsync();
  const nxJson = readNxJson(tree);
  let [canMigrateBuildExecutor, targetDefaultOptionsToMigrate] =
    checkTargetDefaultsForBuildExecutorInvalidOptions(nxJson);

  const remixProjectNames: Record<string, Set<string>> = {};

  const targetNameCounts: Record<
    keyof typeof executors,
    Record<string, number>
  > = {
    build: {},
    serve: {},
  };
  getProjectsAndTargetToMigrate(
    tree,
    canMigrateBuildExecutor,
    nxJson,
    remixProjectNames,
    targetNameCounts
  );

  const { preferredBuildTargetName, preferredServeTargetName } =
    getPreferredBuildServeTargetNames(targetNameCounts);

  for (const [projectName, targetNames] of Object.entries(remixProjectNames)) {
    const projectTargets = projectGraph.nodes[projectName].data.targets;

    let updatedProject = false;

    updatedProject = migrateBuildTarget(
      tree,
      projectGraph,
      targetNames,
      preferredBuildTargetName,
      projectName,
      projectTargets,
      updatedProject,
      targetDefaultOptionsToMigrate
    );

    updatedProject = migrateServeTarget(
      targetNames,
      preferredServeTargetName,
      projectTargets,
      updatedProject
    );

    updatedProject = removeAdditionalTargets(projectTargets, updatedProject);

    if (updatedProject) {
      updateProjectConfiguration(tree, projectName, {
        ...projectGraph.nodes[projectName].data,
        targets: projectTargets,
      });
    }
  }

  addPlugin(tree, preferredBuildTargetName, preferredServeTargetName);
}

/**
 * Iterate through the current target and it's options comparing it to default target
 * Delete matching properties from current target
 * @param currentTarget The user's target from project.json
 * @param defaultTarget A target configuration that matches what can be handled by the plugin
 */
function deleteMatchingProperties(
  currentTarget: TargetConfiguration,
  defaultTarget: TargetConfiguration
) {
  for (const key in currentTarget) {
    if (key === 'outputPath') {
      continue;
    } else if (Array.isArray(currentTarget[key])) {
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
 * @param preferredBuildTargetName The most common target name using the build executor
 * @param preferredServeTargetName The most common target name using the serve executor
 */
function addPlugin(
  tree: Tree,
  preferredBuildTargetName: string,
  preferredServeTargetName: string
) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  let addNewPluginEntry = true;
  for (let i = 0; i < nxJson.plugins.length; i++) {
    const plugin = nxJson.plugins[i];
    if (
      typeof plugin === 'string' &&
      plugin === '@nx/remix/plugin' &&
      preferredBuildTargetName ===
        defaultCrystalPluginOptions.buildTargetName &&
      preferredServeTargetName === defaultCrystalPluginOptions.devTargetName
    ) {
      addNewPluginEntry = false;
    } else if (
      typeof plugin === 'object' &&
      plugin.plugin === '@nx/remix/plugin'
    ) {
      const pluginOptions: RemixPluginOptions = plugin.options;
      if (
        !pluginOptions &&
        preferredBuildTargetName ===
          defaultCrystalPluginOptions.buildTargetName &&
        preferredServeTargetName === defaultCrystalPluginOptions.devTargetName
      ) {
        addNewPluginEntry = false;
      } else if (
        ((pluginOptions.buildTargetName &&
          pluginOptions.buildTargetName === preferredBuildTargetName) ||
          (!pluginOptions.buildTargetName &&
            preferredBuildTargetName ===
              defaultCrystalPluginOptions.buildTargetName)) &&
        ((pluginOptions.devTargetName &&
          pluginOptions.devTargetName === preferredServeTargetName) ||
          (!pluginOptions.devTargetName &&
            preferredServeTargetName ===
              defaultCrystalPluginOptions.devTargetName))
      ) {
        addNewPluginEntry = false;
      }
    }
  }

  if (addNewPluginEntry) {
    nxJson.plugins.push({
      plugin: '@nx/remix/plugin',
      options: {
        buildTargetName: preferredBuildTargetName,
        devTargetName: preferredServeTargetName,
        startTargetName: defaultCrystalPluginOptions.startTargetName,
        typecheckTargetName: defaultCrystalPluginOptions.typecheckTargetName,
      },
    });

    updateNxJson(tree, nxJson);
  }
}

/**
 * Update the remix.config.{mjs|cjs|js} config file to set the correct output path
 * @param tree Virtual Tree
 * @param projectRoot Root path to the project
 * @param desiredOutputPath Output path that should be used by Remix
 */
function updateRemixConfigFileToSetOutputDirectory(
  tree: Tree,
  projectRoot: string,
  desiredOutputPath: string
) {
  const children = tree.children(projectRoot);
  const remixConfigFile = children.find((file) =>
    /remix\.config\.(m|c)*js/.test(file)
  );
  if (desiredOutputPath.startsWith(projectRoot)) {
    desiredOutputPath = desiredOutputPath.replace(`${projectRoot}/`, '');
  } else {
    desiredOutputPath = joinPathFragments(
      offsetFromRoot(projectRoot),
      desiredOutputPath
    );
  }

  const pathToRemixConfigFile = joinPathFragments(projectRoot, remixConfigFile);

  const remixConfigFileContents = tree.read(pathToRemixConfigFile, 'utf-8');
  const CONFIG_PROPERTY_ASSIGNMENT_SELECTOR = remixConfigFileContents.includes(
    'export default'
  )
    ? 'ExportAssignment > ObjectLiteralExpression PropertyAssignment'
    : 'PropertyAccessExpression:has(Identifier[name=module] ~ Identifier[name=exports]) ~ ObjectLiteralExpression PropertyAssignment';
  const configAst = tsquery.ast(remixConfigFileContents);
  const propertyAssignmentNodes = tsquery(
    configAst,
    CONFIG_PROPERTY_ASSIGNMENT_SELECTOR,
    { visitAllChildren: true }
  );
  let updatedExistingOutputPath = false;
  for (const node of propertyAssignmentNodes) {
    if (!node.getText().startsWith('serverBuildPath')) {
      continue;
    }
    const propertyValueNode = tsquery(node, 'StringLiteral', {
      visitAllChildren: true,
    });
    const propertyValue = propertyValueNode[0].getText().replace(/(["'])/, '');
    if (desiredOutputPath !== propertyValue) {
      const fullOutputPath = joinPathFragments(
        desiredOutputPath,
        propertyValue
      );
      tree.write(
        pathToRemixConfigFile,
        `${remixConfigFileContents.slice(
          0,
          node.getStart()
        )}serverBuildPath: \`${fullOutputPath}\`,\n${remixConfigFileContents.slice(
          node.getEnd()
        )}`
      );
      updatedExistingOutputPath = true;
    }
  }
  if (!updatedExistingOutputPath) {
    const fullOutputPath = joinPathFragments(
      desiredOutputPath,
      'build/index.js'
    );
    tree.write(
      pathToRemixConfigFile,
      `${remixConfigFileContents.slice(
        0,
        propertyAssignmentNodes[0].getStart()
      )}serverBuildPath: \`${fullOutputPath}\`,\n${remixConfigFileContents.slice(
        propertyAssignmentNodes[0].getStart()
      )}`
    );
  }
}

/**
 * Remove any additional remix-only targets that are not using executors
 * @param projectTargets Targets defined in the project's project.json
 * @param isProjectUpdatedAlready Whether the project has been updated already to prevent false negatives
 */
function removeAdditionalTargets(
  projectTargets: Record<string, TargetConfiguration>,
  isProjectUpdatedAlready: boolean = false
) {
  let updatedProject = isProjectUpdatedAlready;
  if (defaultCrystalPluginOptions.startTargetName in projectTargets) {
    delete projectTargets[defaultCrystalPluginOptions.startTargetName];
    updatedProject = true;
  }

  if (defaultCrystalPluginOptions.typecheckTargetName in projectTargets) {
    delete projectTargets[defaultCrystalPluginOptions.typecheckTargetName];
    updatedProject = true;
  }
  return updatedProject;
}

/**
 * Check for the build executor in targetDefaults for invalid options that cannot be migrated
 * And creates a key-value pair of options that need to be migrated to the build target in project.json
 * @param nxJson NxJsonConfiguration
 */
function checkTargetDefaultsForBuildExecutorInvalidOptions(
  nxJson: NxJsonConfiguration
): [boolean, Record<string, any>] {
  let canMigrateBuildExecutor = true;
  let targetDefaultOptions: Record<string, any> = {};
  if (nxJson.targetDefaults) {
    if (
      executors.build in nxJson.targetDefaults &&
      nxJson.targetDefaults[executors.build].options
    ) {
      const targetDefaultConfigKeys = Object.keys(
        nxJson.targetDefaults[executors.build].options
      );
      if (
        targetDefaultConfigKeys.some((v) =>
          nonMigratableOptions.build.includes(v)
        )
      ) {
        // non-migratable properties exist in the targetDefaults for the build executor
        // cannot migrate build target
        canMigrateBuildExecutor = false;
      } else {
        // the options are migratable, list them in key-value pair
        // to be added to the build target on the project.json
        targetDefaultOptions = targetDefaultConfigKeys.reduce(
          (opts, key) => ({
            ...opts,
            [key]: nxJson.targetDefaults[executors.build].options[key],
          }),
          targetDefaultOptions
        );
      }
    }
  }
  return [canMigrateBuildExecutor, targetDefaultOptions];
}

/**
 * Check for the target name in targetDefaults for invalid options that cannot be migrated
 * And also check that the project.json does not define invalid targets
 * @param targetName Name of the target
 * @param targetOptions The options for that target as defined by project.json
 * @param nxJson NxJsonConfiguration
 */
function checkTargetAndTargetDefaultsForTargetInvalidOptions(
  targetName: string,
  targetOptions: any,
  nxJson: NxJsonConfiguration
) {
  const hasNonMigratableProperty =
    targetName in nonMigratableOptions &&
    Object.keys(targetOptions).some((v) =>
      nonMigratableOptions[targetName].includes(v)
    );

  let hasNonMigratableTargetInTargetDefaults = false;
  if (nxJson.targetDefaults) {
    if (
      targetName in nxJson.targetDefaults &&
      nxJson.targetDefaults[targetName].options
    ) {
      const targetDefaultConfigKeys = Object.keys(
        nxJson.targetDefaults[targetName].options
      );
      if (
        targetDefaultConfigKeys.some((v) =>
          nonMigratableOptions.build.includes(v)
        )
      ) {
        // non-migratable properties exist in the targetDefaults for the build executor
        // cannot migrate build target
        hasNonMigratableTargetInTargetDefaults = true;
      }
    }
  }
  return { hasNonMigratableProperty, hasNonMigratableTargetInTargetDefaults };
}

/**
 * Get the most common target names for the build and serve targets based on executor usage
 * @param targetNameCounts Object containing the counts of usages of target names
 */
function getPreferredBuildServeTargetNames(
  targetNameCounts: Record<keyof typeof executors, Record<string, number>>
) {
  const buildTargetNames = Object.keys(targetNameCounts.build);
  let preferredBuildTargetName =
    buildTargetNames[0] ?? defaultCrystalPluginOptions.buildTargetName;
  if (buildTargetNames.length > 1) {
    preferredBuildTargetName = buildTargetNames.reduce(
      (preferredName, currentName) =>
        targetNameCounts.build[preferredName] >=
        targetNameCounts.build[currentName]
          ? preferredName
          : currentName,
      preferredBuildTargetName
    );
  }

  const serveTargetNames = Object.keys(targetNameCounts.serve);
  let preferredServeTargetName =
    serveTargetNames[0] ?? defaultCrystalPluginOptions.devTargetName;
  if (serveTargetNames.length > 1) {
    preferredServeTargetName = serveTargetNames.reduce(
      (preferredName, currentName) =>
        targetNameCounts.serve[preferredName] >=
        targetNameCounts.serve[currentName]
          ? preferredName
          : currentName,
      serveTargetNames[0]
    );
  }
  return { preferredBuildTargetName, preferredServeTargetName };
}

/**
 * Iterate through the workspace checking for Remix executors,
 * find if they can be migrated and add them to a list of projects and targets to migrate
 * @param tree Virtual Tree
 * @param canMigrateBuildExecutor Whether the targetDefaults contains options that cannot be migrated
 * @param nxJson NxJsonConfiguration
 * @param remixProjectNames Set to store the projects and targets to migrate
 * @param targetNameCounts Count of target name occurrences for each executor
 */
function getProjectsAndTargetToMigrate(
  tree: Tree,
  canMigrateBuildExecutor: boolean,
  nxJson: NxJsonConfiguration,
  remixProjectNames: Record<string, Set<string>>,
  targetNameCounts: Record<keyof typeof executors, Record<string, number>>
) {
  for (const targetExecutor of Object.keys(executors)) {
    if (
      executors[targetExecutor] === executors.build &&
      !canMigrateBuildExecutor
    ) {
      continue;
    }

    forEachExecutorOptions(
      tree,
      executors[targetExecutor],
      (targetOptions, projectName, targetName) => {
        const {
          hasNonMigratableProperty,
          hasNonMigratableTargetInTargetDefaults,
        } = checkTargetAndTargetDefaultsForTargetInvalidOptions(
          targetName,
          targetOptions,
          nxJson
        );

        if (
          hasNonMigratableProperty ||
          hasNonMigratableTargetInTargetDefaults
        ) {
          return;
        }

        if (!(projectName in remixProjectNames)) {
          remixProjectNames[projectName] = new Set();
        }
        remixProjectNames[projectName].add(targetName);

        targetNameCounts[targetExecutor][targetName] =
          targetName in targetNameCounts[targetExecutor]
            ? targetNameCounts[targetExecutor][targetName] + 1
            : 1;
      }
    );
  }
}

/**
 * Migrate the build target by deleting properties from the project.json that match what will be inferred
 * @param tree Virtual Tree
 * @param projectGraph Project Graph of the Workspace
 * @param targetNames Project's target names
 * @param preferredBuildTargetName Most common occurrence of the build target name to migrate
 * @param projectName Name of the project to migrate
 * @param projectTargets Project's targets and their configurations
 * @param updatedProject Whether the project has been updated
 */
function migrateBuildTarget(
  tree: Tree,
  projectGraph: ProjectGraph,
  targetNames: Set<string>,
  preferredBuildTargetName: string,
  projectName: string,
  projectTargets: Record<string, TargetConfiguration>,
  updatedProject: boolean,
  targetDefaultOptionsToMigrate: Record<string, any>
) {
  if (targetNames.has(preferredBuildTargetName)) {
    const defaultBuildOptions = defaultOptionsForExecutors.build(
      projectGraph.nodes[projectName].data.root
    );
    let currentTargetOptions = projectTargets[preferredBuildTargetName];
    if (currentTargetOptions.options?.outputPath) {
      let desiredOutputPath = currentTargetOptions.options.outputPath;

      updateRemixConfigFileToSetOutputDirectory(
        tree,
        projectGraph.nodes[projectName].data.root,
        desiredOutputPath
      );
      delete projectTargets[preferredBuildTargetName].options.outputPath;
      delete projectTargets[preferredBuildTargetName].outputs;
    }

    currentTargetOptions = {
      // current target options exist in the project.json, and would override targetDefaults
      ...currentTargetOptions,
      options: {
        ...targetDefaultOptionsToMigrate,
        ...(currentTargetOptions.options ?? {}),
      },
    };

    deleteMatchingProperties(currentTargetOptions, defaultBuildOptions);
    delete projectTargets[preferredBuildTargetName].executor;

    if (Object.values(currentTargetOptions).length === 0) {
      delete projectTargets[preferredBuildTargetName];
    } else {
      projectTargets[preferredBuildTargetName] = currentTargetOptions;
    }

    updatedProject = true;
  }
  return updatedProject;
}

/**
 * Migrate the serve target by deleting properties from the project.json that match what will be inferred
 * @param targetNames Project's target names
 * @param preferredServeTargetName Most common occurrence of the serve target name to migrate
 * @param projectTargets Project's targets and their configurations
 * @param updatedProject Whether the project has been updated
 */
function migrateServeTarget(
  targetNames: Set<string>,
  preferredServeTargetName: string,
  projectTargets: Record<string, TargetConfiguration>,
  updatedProject: boolean
) {
  if (targetNames.has(preferredServeTargetName)) {
    const defaultServeOptions = defaultOptionsForExecutors.serve;
    const currentTargetOptions = projectTargets[preferredServeTargetName];
    deleteMatchingProperties(currentTargetOptions, defaultServeOptions);
    delete projectTargets[preferredServeTargetName].executor;
    if (Object.values(currentTargetOptions).length === 0) {
      delete projectTargets[preferredServeTargetName];
    } else {
      if (currentTargetOptions.options.port) {
        currentTargetOptions.options.env ??= {};
        currentTargetOptions.options.env.PORT =
          currentTargetOptions.options.port;
        delete currentTargetOptions.options.port;
      }
      projectTargets[preferredServeTargetName] = currentTargetOptions;
    }

    updatedProject = true;
  }
  return updatedProject;
}
