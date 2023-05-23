import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import {
  updateJson,
  Tree,
  getProjects,
  joinPathFragments,
  readJson,
  updateProjectConfiguration,
  formatFiles,
} from '@nx/devkit';
import { posix } from 'path';

export async function fixLegacyCypressTsconfig(tree: Tree) {
  const projects = getProjects(tree);
  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nx/cypress:cypress',
    (options, projectName, targetName, configName) => {
      const projectConfig = projects.get(projectName);

      if (
        options.testingType !== 'e2e' &&
        projectConfig.targets[targetName]?.options?.testingType !== 'e2e'
      ) {
        return;
      }

      const tsconfigToRemove =
        options.tsConfig ??
        joinPathFragments(projectConfig.root, 'tsconfig.e2e.json');

      const projectLevelConfigPath = joinPathFragments(
        projectConfig.root,
        'tsconfig.json'
      );

      if (
        !tree.exists(projectLevelConfigPath) ||
        !tree.exists(tsconfigToRemove)
      ) {
        return;
      }

      if (tsconfigToRemove === projectLevelConfigPath) {
        updateJson(tree, projectLevelConfigPath, (json) => {
          json.compilerOptions = {
            sourceMap: false,
            ...json.compilerOptions,
          };
          return json;
        });
      } else {
        const e2eConfig = readJson(tree, tsconfigToRemove);

        updateJson(tree, projectLevelConfigPath, (json) => {
          json.compilerOptions = {
            sourceMap: false,
            ...json.compilerOptions,
            ...e2eConfig.compilerOptions,
          };
          json.files = Array.from(
            new Set([...(json.files ?? []), ...(e2eConfig.files ?? [])])
          );
          json.include = Array.from(
            new Set([...(json.include ?? []), ...(e2eConfig.include ?? [])])
          );
          json.exclude = Array.from(
            new Set([...(json.exclude ?? []), ...(e2eConfig.exclude ?? [])])
          );

          // these paths will always be 'unix style'
          // and on windows relative will not work on these paths
          const tsConfigFromProjRoot = posix.relative(
            projectConfig.root,
            tsconfigToRemove
          );

          json.references = (json.references ?? []).filter(
            ({ path }) => !path.includes(tsConfigFromProjRoot)
          );
          return json;
        });

        tree.delete(tsconfigToRemove);
      }

      if (configName) {
        delete projectConfig.targets[targetName].configurations[configName]
          .tsConfig;
      } else {
        delete projectConfig.targets[targetName].options.tsConfig;
      }

      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  );

  await formatFiles(tree);
}

export default fixLegacyCypressTsconfig;
