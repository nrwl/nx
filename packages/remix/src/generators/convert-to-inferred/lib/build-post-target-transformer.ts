import { type Tree, type TargetConfiguration } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { addConfigValuesToConfigFile, getConfigFilePath } from './utils';
import {
  processTargetOutputs,
  toProjectRelativePath,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { tsquery } from '@phenomnomnominal/tsquery';

type RemixConfigValues = { outputPath?: string };

export function buildPostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    const remixConfigPath = getConfigFilePath(tree, projectDetails.root);
    const configValues: Record<string, RemixConfigValues> = {
      default: {},
    };

    if (target.options) {
      handlePropertiesFromTargetOptions(
        tree,
        target.options,
        projectDetails.projectName,
        projectDetails.root,
        configValues['default'],
        migrationLogs
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];

        handlePropertiesFromTargetOptions(
          tree,
          configuration,
          projectDetails.projectName,
          projectDetails.root,
          configValues[configurationName],
          migrationLogs
        );

        if (Object.keys(configuration).length === 0) {
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
      target.outputs = target.outputs.filter(
        (out) => !out.includes('options.outputPath')
      );
      processTargetOutputs(target, [], inferredTargetConfiguration, {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      });
    }

    setRemixConfigToUseConfigValueForOutput(
      tree,
      remixConfigPath,
      projectDetails.projectName,
      migrationLogs
    );
    addConfigValuesToConfigFile(tree, remixConfigPath, configValues);

    return target;
  };
}

function handlePropertiesFromTargetOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string,
  configValues: RemixConfigValues,
  migrationLogs: AggregatedLog
) {
  if ('outputPath' in options) {
    configValues.outputPath = toProjectRelativePath(
      options.outputPath,
      projectRoot
    );
    delete options.outputPath;
  }

  if ('includeDevDependenciesInPackageJson' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/remix:build',
      log: "Unable to migrate `includeDevDependenciesInPackageJson` to Remix Config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.includeDevDependenciesInPackageJson;
  }

  if ('generatePackageJson' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/remix:build',
      log: "Unable to migrate `generatePackageJson` to Remix Config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.generatePackageJson;
  }

  if ('generateLockfile' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/remix:build',
      log: "Unable to migrate `generateLockfile` to Remix Config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.generateLockfile;
  }
}

function setRemixConfigToUseConfigValueForOutput(
  tree: Tree,
  configFilePath: string,
  projectName: string,
  migrationLogs: AggregatedLog
) {
  const configFileContents = tree.read(configFilePath, 'utf-8');
  const ast = tsquery.ast(configFileContents);

  let startPosition = 0;
  let endPosition = 0;

  const OUTPUT_PATH_SELECTOR =
    'ExportAssignment ObjectLiteralExpression PropertyAssignment:has(Identifier[name=serverBuildPath]) > StringLiteral';
  const outputPathNodes = tsquery(ast, OUTPUT_PATH_SELECTOR, {
    visitAllChildren: true,
  });
  if (outputPathNodes.length !== 0) {
    startPosition = outputPathNodes[0].getStart();
    endPosition = outputPathNodes[0].getEnd();
  } else {
    const EXPORT_CONFIG_SELECTOR = 'ExportAssignment ObjectLiteralExpression';
    const configNodes = tsquery(ast, EXPORT_CONFIG_SELECTOR, {
      visitAllChildren: true,
    });
    if (configNodes.length === 0) {
      migrationLogs.addLog({
        project: projectName,
        executorName: '@nx/remix:build',
        log: 'Unable to update Remix Config to set `serverBuildPath` to custom `outputPath` found in project.json. Please update this manually.',
      });
      return;
    } else {
      startPosition = configNodes[1].getStart();
      endPosition = startPosition;
    }
  }

  tree.write(
    configFilePath,
    `${configFileContents.slice(
      0,
      startPosition
    )}options.outputPath${configFileContents.slice(endPosition)}`
  );
}
