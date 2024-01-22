import { Tree, getProjects, updateProjectConfiguration } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { VitestExecutorOptions } from '../../executors/test/schema';

type OldVitestExecutorOptions = Omit<VitestExecutorOptions, 'testFiles'> & {
  testFile: string;
};

export default function update(tree: Tree) {
  const projects = getProjects(tree);

  forEachExecutorOptions<OldVitestExecutorOptions>(
    tree,
    '@nx/vite:test',
    (options, projectName, targetName, configuration) => {
      const projectConfig = projects.get(projectName);

      if (!options.testFile) {
        return;
      }

      const newTestFileArgs = [options.testFile];

      delete options.testFile;

      if (configuration) {
        projectConfig.targets[targetName].configurations[configuration] = {
          ...options,
          testFiles: newTestFileArgs,
        };
      } else {
        projectConfig.targets[targetName].options = {
          ...options,
          testFiles: newTestFileArgs,
        };
      }

      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  );
}
