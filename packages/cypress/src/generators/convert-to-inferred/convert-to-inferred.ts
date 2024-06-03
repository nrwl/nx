import {
  createProjectGraphAsync,
  formatFiles,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { createNodesV2 } from '../../plugins/plugin';
import { targetOptionsToCliMap } from './lib/target-options-map';
import { upsertBaseUrl } from './lib/upsert-baseUrl';
import { addDevServerTargetToConfig } from './lib/add-dev-server-target-to-config';
import { addExcludeSpecPattern } from './lib/add-exclude-spec-pattern';

interface Schema {
  project?: string;
  all?: boolean;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migratedProjectsModern = await migrateExecutorToPlugin(
    tree,
    projectGraph,
    '@nx/cypress:cypress',
    '@nx/cypress/plugin',
    (targetName) => ({
      targetName,
      ciTargetName: 'e2e-ci',
    }),
    postTargetTransformer,
    createNodesV2,
    options.project
  );

  const migratedProjectsLegacy = await migrateExecutorToPlugin(
    tree,
    projectGraph,
    '@nrwl/cypress:cypress',
    '@nx/cypress/plugin',
    (targetName) => ({
      targetName,
      ciTargetName: 'e2e-ci',
    }),
    postTargetTransformer,
    createNodesV2,
    options.project
  );

  const migratedProjects =
    migratedProjectsModern.size + migratedProjectsLegacy.size;

  if (migratedProjects === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function postTargetTransformer(
  target: TargetConfiguration,
  tree: Tree
): TargetConfiguration {
  if (target.options) {
    const configFilePath = target.options.cypressConfig;

    delete target.options.cypressConfig;
    delete target.options.copyFiles;
    delete target.options.skipServe;

    for (const key in targetOptionsToCliMap) {
      if (target.options[key]) {
        target.options[targetOptionsToCliMap[key]] = target.options[key];
        delete target.options[key];
      }
    }

    if ('exit' in target.options && !target.options.exit) {
      delete target.options.exit;
      target.options['no-exit'] = true;
    }

    if (target.options.testingType) {
      delete target.options.testingType;
    }

    if (target.options.watch) {
      target.options.headed = true;
      target.options['no-exit'] = true;
      delete target.options.watch;
    }

    if (target.options.baseUrl) {
      upsertBaseUrl(tree, configFilePath, target.options.baseUrl);
      delete target.options.baseUrl;
    }

    if (target.options.devServerTarget) {
      const webServerCommands: Record<string, string> = {
        default: `npx nx run ${target.options.devServerTarget}`,
      };
      delete target.options.devServerTarget;

      if (target.configurations) {
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

    if (target.options.ignoreTestFiles) {
      addExcludeSpecPattern(
        tree,
        configFilePath,
        target.options.ignoreTestFiles
      );
      delete target.options.ignoreTestFiles;
    }

    if (Object.keys(target.options).length === 0) {
      delete target.options;
    }
    if (
      target.configurations &&
      Object.keys(target.configurations).length !== 0
    ) {
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

  return target;
}

export default convertToInferred;
