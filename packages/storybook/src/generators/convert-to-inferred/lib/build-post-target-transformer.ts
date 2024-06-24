import { joinPathFragments, TargetConfiguration, Tree } from '@nx/devkit';
import {
  processTargetOutputs,
  toProjectRelativePath,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import {
  addConfigValuesToConfigFile,
  ensureViteConfigPathIsRelative,
  getConfigFilePath,
  STORYBOOK_PROP_MAPPINGS,
} from './utils';
import { getInstalledPackageVersionInfo } from './utils';

type StorybookConfigValues = { docsMode?: boolean; staticDir?: string };

export function buildPostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    let defaultConfigDir = joinPathFragments(projectDetails.root, '.storybook');

    const configValues: Record<string, StorybookConfigValues> = {
      default: {},
    };

    if (target.options) {
      if (target.options.configDir) {
        defaultConfigDir = target.options.configDir;
      }

      handlePropertiesFromTargetOptions(
        tree,
        target.options,
        defaultConfigDir,
        projectDetails.projectName,
        projectDetails.root,
        configValues['default'],
        migrationLogs
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        configValues[configurationName] = {};
        handlePropertiesFromTargetOptions(
          tree,
          configuration,
          defaultConfigDir,
          projectDetails.projectName,
          projectDetails.root,
          configValues[configurationName],
          migrationLogs
        );
      }

      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        if (
          configuration.configDir &&
          configuration.configDir !==
            toProjectRelativePath(defaultConfigDir, projectDetails.root)
        ) {
          const configFilePath = getConfigFilePath(
            tree,
            joinPathFragments(projectDetails.root, configuration.configDir)
          );
          addConfigValuesToConfigFile(tree, configFilePath, configValues);
          ensureViteConfigPathIsRelative(
            tree,
            configFilePath,
            projectDetails.projectName,
            projectDetails.root,
            '@nx/storybook:build',
            migrationLogs
          );
        }

        if (
          configurationName === 'ci' &&
          Object.keys(configuration).length === 0
        ) {
          delete target.configurations[configurationName];
        }
      }

      if (Object.keys(target.configurations).length === 0) {
        if ('defaultConfiguration' in target) {
          delete target.defaultConfiguration;
        }
        delete target.configurations;
      }

      if (
        'defaultConfiguration' in target &&
        !target.configurations[target.defaultConfiguration]
      ) {
        delete target.defaultConfiguration;
      }
    }

    if (target.outputs) {
      processTargetOutputs(
        target,
        [{ newName: 'output-dir', oldName: 'outputDir' }],
        inferredTargetConfiguration,
        {
          projectName: projectDetails.projectName,
          projectRoot: projectDetails.root,
        }
      );
    }

    addConfigValuesToConfigFile(
      tree,
      getConfigFilePath(tree, defaultConfigDir),
      configValues
    );
    ensureViteConfigPathIsRelative(
      tree,
      getConfigFilePath(tree, defaultConfigDir),
      projectDetails.projectName,
      projectDetails.root,
      '@nx/storybook:build',
      migrationLogs
    );

    return target;
  };
}

function handlePropertiesFromTargetOptions(
  tree: Tree,
  options: any,
  defaultConfigDir: string,
  projectName: string,
  projectRoot: string,
  configValues: StorybookConfigValues,
  migrationLogs: AggregatedLog
) {
  let configDir = defaultConfigDir;
  if ('configDir' in options) {
    if (options.configDir !== defaultConfigDir) {
      configDir = options.configDir as string;
    }
    options.configDir = toProjectRelativePath(options.configDir, projectRoot);
  }

  if (options.outputDir) {
    options.outputDir = toProjectRelativePath(options.outputDir, projectRoot);
  }

  if ('styles' in options) {
    delete options.styles;
  }
  if ('stylePreprocessorOptions' in options) {
    delete options.stylePreprocessorOptions;
  }

  if ('docsMode' in options) {
    configValues.docsMode = options.docsMode;
    moveDocsModeToConfigFile(
      tree,
      configDir,
      projectName,
      migrationLogs,
      configDir === defaultConfigDir
    );
    delete options.docsMode;
  }

  if ('staticDir' in options) {
    configValues.staticDir = options.staticDir;
    moveStaticDirToConfigFile(
      tree,
      configDir,
      projectName,
      migrationLogs,
      configDir === defaultConfigDir
    );
    delete options.staticDir;
  }

  const storybookPropMappings =
    getInstalledPackageVersionInfo(tree, 'storybook')?.major === 8
      ? STORYBOOK_PROP_MAPPINGS.v8
      : STORYBOOK_PROP_MAPPINGS.v7;
  for (const [prevKey, newKey] of Object.entries(storybookPropMappings)) {
    if (prevKey in options) {
      let prevValue = options[prevKey];
      delete options[prevKey];
      options[newKey] = prevValue;
    }
  }
}

function moveDocsModeToConfigFile(
  tree: Tree,
  configDir: string,
  projectName: string,
  migrationLogs: AggregatedLog,
  useConfigValues = true
) {
  const configFilePath = getConfigFilePath(tree, configDir);
  const configFileContents = tree.read(configFilePath, 'utf-8');

  const ast = tsquery.ast(configFileContents);
  const CONFIG_OBJECT_SELECTOR =
    'VariableDeclaration:has(Identifier[name=config]) ObjectLiteralExpression';
  const DOCS_MODE_SELECTOR =
    'PropertyAssignment:has(Identifier[name=docs]) PropertyAssignment:has(Identifier[name=docsMode])';
  const DOCS_SELECTOR = 'PropertyAssignment:has(Identifier[name=docs])';

  const configNodes = tsquery(ast, CONFIG_OBJECT_SELECTOR, {
    visitAllChildren: true,
  });

  if (configNodes.length === 0) {
    // Invalid config file
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/storybook:build',
      log: 'Could not find a valid Storybook Config to migrate `docsMode`. Update your `main.ts` file to add `docsMode`.',
    });
    return;
  }

  const configNode = configNodes[0];
  const hasDocsMode =
    tsquery(configNode, DOCS_MODE_SELECTOR, { visitAllChildren: true }).length >
    0;
  if (hasDocsMode) {
    return;
  }

  let startPosition = configNode.getStart() + 1;
  let needsDocObject = true;

  const docsNodes = tsquery(configNode, DOCS_SELECTOR, {
    visitAllChildren: true,
  });
  if (docsNodes.length > 0) {
    needsDocObject = false;
    startPosition = docsNodes[0].getStart() + 1;
  }

  const docsModeInsert = `options.docsMode`;
  const nodeToInsert = needsDocObject
    ? `docs: { docsMode: ${docsModeInsert} },`
    : `docsMode: ${docsModeInsert},`;
  tree.write(
    configFilePath,
    `${configFileContents.slice(
      0,
      startPosition
    )}${nodeToInsert}${configFileContents.slice(startPosition)}`
  );
}

function moveStaticDirToConfigFile(
  tree: Tree,
  configDir: string,
  projectName: string,
  migrationLogs: AggregatedLog,
  useConfigValues = true
) {
  const configFilePath = getConfigFilePath(tree, configDir);
  const configFileContents = tree.read(configFilePath, 'utf-8');

  const ast = tsquery.ast(configFileContents);
  const CONFIG_OBJECT_SELECTOR =
    'VariableDeclaration:has(Identifier[name=config]) ObjectLiteralExpression';
  const STATIC_DIRS_SELECTOR =
    'PropertyAssignment:has(Identifier[name=staticDirs])';

  const configNodes = tsquery(ast, CONFIG_OBJECT_SELECTOR, {
    visitAllChildren: true,
  });

  if (configNodes.length === 0) {
    // Invalid config file
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/storybook:build',
      log: 'Could not find a valid Storybook Config to migrate `staticDir`. Update your `main.ts` file to add `staticDirs`.',
    });
    return;
  }

  const configNode = configNodes[0];
  const hasStaticDir =
    tsquery(configNode, STATIC_DIRS_SELECTOR, { visitAllChildren: true })
      .length > 0;
  if (hasStaticDir) {
    return;
  }

  let startPosition = configNode.getStart() + 1;

  const nodeToInsert = `staticDirs: options.staticDir,`;
  tree.write(
    configFilePath,
    `${configFileContents.slice(
      0,
      startPosition
    )}${nodeToInsert}${configFileContents.slice(startPosition)}`
  );
}
