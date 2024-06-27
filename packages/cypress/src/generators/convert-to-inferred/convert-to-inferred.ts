import {
  createProjectGraphAsync,
  formatFiles,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { migrateProjectExecutorsToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import {
  processTargetOutputs,
  toProjectRelativePath,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { createNodesV2, type CypressPluginOptions } from '../../plugins/plugin';
import { addDevServerTargetToConfig } from './lib/add-dev-server-target-to-config';
import { addExcludeSpecPattern } from './lib/add-exclude-spec-pattern';
import { targetOptionsToCliMap } from './lib/target-options-map';
import { upsertBaseUrl } from './lib/upsert-baseUrl';

interface Schema {
  project?: string;
  all?: boolean;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migratedProjects =
    await migrateProjectExecutorsToPlugin<CypressPluginOptions>(
      tree,
      projectGraph,
      '@nx/cypress/plugin',
      createNodesV2,
      {
        targetName: 'cypress',
        ciTargetName: 'e2e-ci',
        componentTestingTargetName: 'component-test',
        openTargetName: 'open-cypress',
      },
      [
        {
          executors: ['@nx/cypress:cypress', '@nrwl/cypress:cypress'],
          postTargetTransformer,
          targetPluginOptionMapper: (targetName) => ({ targetName }),
        },
      ],
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
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
): TargetConfiguration {
  if (target.options) {
    handlePropertiesInOptions(
      tree,
      target.options,
      projectDetails.root,
      target
    );

    if (Object.keys(target.options).length === 0) {
      delete target.options;
    }
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      handlePropertiesInOptions(
        tree,
        configuration,
        projectDetails.root,
        target
      );
    }

    if (Object.keys(target.configurations).length !== 0) {
      for (const configuration in target.configurations) {
        if (Object.keys(target.configurations[configuration]).length === 0) {
          delete target.configurations[configuration];
        }
      }
      if (Object.keys(target.configurations).length === 0) {
        delete target.configurations;
      }
    }
  }

  if (target.outputs) {
    processTargetOutputs(target, [], inferredTargetConfiguration, {
      projectName: projectDetails.projectName,
      projectRoot: projectDetails.root,
    });
  }

  return target;
}

function handlePropertiesInOptions(
  tree: Tree,
  options: Record<string, any>,
  projectRoot: string,
  target: TargetConfiguration
) {
  let configFilePath: string;
  if ('cypressConfig' in options) {
    configFilePath = options.cypressConfig;
    options['config-file'] = toProjectRelativePath(configFilePath, projectRoot);
    delete options.cypressConfig;
  }

  if ('copyFiles' in options) {
    delete options.copyFiles;
  }

  if ('skipServe' in options) {
    delete options.skipServe;
  }

  for (const key in targetOptionsToCliMap) {
    if (options[key]) {
      const prevValue = options[key];
      delete options[key];
      options[targetOptionsToCliMap[key]] = prevValue;
    }
  }

  if ('exit' in options && !options.exit) {
    delete options.exit;
    options['no-exit'] = true;
  }

  if ('testingType' in options) {
    delete options.testingType;
  }

  if ('watch' in options) {
    options.headed = true;
    options['no-exit'] = true;
    delete options.watch;
  }

  if (options.baseUrl && configFilePath) {
    upsertBaseUrl(tree, configFilePath, options.baseUrl);
    delete options.baseUrl;
  }

  if (options.devServerTarget && configFilePath) {
    const webServerCommands: Record<string, string> = {
      default: `npx nx run ${options.devServerTarget}`,
    };
    delete options.devServerTarget;

    if (target.configurations && configFilePath) {
      for (const configuration in target.configurations) {
        if (target.configurations[configuration]?.devServerTarget) {
          webServerCommands[
            configuration
          ] = `npx nx run ${target.configurations[configuration].devServerTarget}`;
          delete target.configurations[configuration].devServerTarget;
        }
      }
    }

    addDevServerTargetToConfig(
      tree,
      configFilePath,
      webServerCommands,
      webServerCommands?.['ci']
    );
  }

  if ('ignoreTestFiles' in options) {
    addExcludeSpecPattern(tree, configFilePath, options.ignoreTestFiles);
    delete options.ignoreTestFiles;
  }
}

export default convertToInferred;
