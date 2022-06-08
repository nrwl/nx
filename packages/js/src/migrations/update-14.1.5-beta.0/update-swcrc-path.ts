import {
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { SwcExecutorOptions } from '../../utils/schema';

type OldSwcExecutorOptions = SwcExecutorOptions & { swcrcPath?: string };

export function updateSwcrcPath(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nrwl/js:swc',
    (_, projectName, targetName, configurationName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);
      const executorOptions: OldSwcExecutorOptions = configurationName
        ? projectConfig.targets[targetName].configurations[configurationName]
        : projectConfig.targets[targetName].options;

      if (!executorOptions.swcrcPath) return;

      const newSwcrcPath = joinPathFragments(
        projectConfig.root,
        executorOptions.swcrcPath
      );

      delete executorOptions.swcrcPath;
      executorOptions.swcrc = newSwcrcPath;

      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  );
}

export default updateSwcrcPath;
