import { Tree, getProjects, updateProjectConfiguration } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { VitestExecutorOptions } from '../../executors/test/schema';

export default function update(tree: Tree) {
  const projects = getProjects(tree);

  forEachExecutorOptions<VitestExecutorOptions>(
    tree,
    '@nx/vite:test',
    (options, projectName, targetName, configuration) => {
      const projectConfig = projects.get(projectName);

      if (!options.testFile) {
        return;
      }

      const migratedOptions = { ...options, testFile: [options.testFile] };

      if (configuration) {
        projectConfig.targets[targetName].configurations[configuration] =
          migratedOptions;
      } else {
        projectConfig.targets[targetName].options = migratedOptions;
      }

      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  );
}
