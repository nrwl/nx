import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import {
  formatFiles,
  installPackagesTask,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { cypressVersion } from '../../utils/versions';
import {
  addConfigToTsConfig,
  createNewCypressConfig,
  findCypressConfigs,
  updatePluginFile,
  updateProjectPaths,
  writeNewConfig,
} from './conversion.util';

export async function migrateCypressProject(tree: Tree) {
  assertMinimumCypressVersion(8);

  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nrwl/cypress:cypress',
    (currentValue, projectName, target, configuration) => {
      try {
        const projectConfig = readProjectConfiguration(tree, projectName);

        const { cypressConfigPathJson, cypressConfigPathTs } =
          findCypressConfigs(tree, projectConfig, target, configuration);

        // a matching cypress ts file hasn't been made yet. need to migrate.
        if (
          tree.exists(cypressConfigPathJson) &&
          !tree.exists(cypressConfigPathTs)
        ) {
          let cypressConfigs = createNewCypressConfig(
            tree,
            projectConfig,
            cypressConfigPathJson
          );

          updateProjectPaths(tree, projectConfig, cypressConfigs);
          cypressConfigs = updatePluginFile(
            tree,
            projectConfig,
            cypressConfigs
          );
          writeNewConfig(tree, cypressConfigPathTs, cypressConfigs);
          addConfigToTsConfig(
            tree,
            projectConfig.targets?.[target]?.configurations?.tsConfig ||
              projectConfig.targets?.[target]?.options?.tsConfig ||
              joinPathFragments(projectConfig.root, 'tsconfig.json'),
            cypressConfigPathTs
          );

          tree.delete(cypressConfigPathJson);
        }
        // ts file has been made and matching json file has been removed only need to update the project config
        if (
          !tree.exists(cypressConfigPathJson) &&
          tree.exists(cypressConfigPathTs)
        ) {
          projectConfig.targets[target].options = {
            ...projectConfig.targets[target].options,
            cypressConfig: cypressConfigPathTs,
            testingType: 'e2e',
          };

          updateProjectConfiguration(tree, projectName, projectConfig);
        }
      } catch (e) {
        logger.error(stripIndents`
NX There was an error converting ${projectName}:${target}.
You can manually update the project by following the migration guide if need be.
https://nx.dev/cypress/v10-migration-guide
  `);
        throw e;
      }
    }
  );

  updateJson(tree, 'package.json', (json) => {
    json.devDependencies['cypress'] = cypressVersion;
    return json;
  });

  await formatFiles(tree);

  if (tree.exists('cypress.json')) {
    logger.warn(stripIndents`A root cypress.json file was found. 
    You should remove this file as it will cause an error when running Cypress.
    If you want to share options between Cypress projects. 
    You can create a root ts file and import it into each project's cypress config file.
    More Info: https://github.com/nrwl/nx/issues/11512#issuecomment-1213420638
    `);
  }
  return () => {
    installPackagesTask(tree);
  };
}

export default migrateCypressProject;
