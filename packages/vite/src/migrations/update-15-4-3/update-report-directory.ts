import {
  getProjects,
  offsetFromRoot,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { VitestExecutorOptions } from '../../executors/test/schema';

export function updateReportDirectoryPlaceholders(tree: Tree) {
  const projects = getProjects(tree);
  forEachExecutorOptions<VitestExecutorOptions>(
    tree,
    '@nrwl/vite:test',
    (options, projectName, targetName, configName) => {
      const projectConfig = projects.get(projectName);
      const coverageOutput =
        projectConfig.root === '.' ? projectName : projectConfig.root;

      if (options.reportsDirectory) {
        options.reportsDirectory = options.reportsDirectory
          .replace(
            '{workspaceRoot}/',
            projectConfig.root === '.' ? '' : offsetFromRoot(projectConfig.root)
          )
          .replace('{projectRoot}', coverageOutput);
        if (configName) {
          projectConfig.targets[targetName].configurations[configName] =
            options;
        } else {
          projectConfig.targets[targetName].options = options;
        }
        if (projectConfig.targets[targetName].outputs) {
          projectConfig.targets[targetName].outputs = projectConfig.targets[
            targetName
          ].outputs.map((output) =>
            output.replace(
              '{projectRoot}/coverage',
              `coverage/${coverageOutput}`
            )
          );
        }
        updateProjectConfiguration(tree, projectName, projectConfig);
      }
    }
  );
}

export default updateReportDirectoryPlaceholders;
