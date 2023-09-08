import { getProjects, joinPathFragments, Tree, formatFiles } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import {
  addStorybookToNamedInputs,
  renameAndMoveOldTsConfig,
} from '../../generators/configuration/lib/util-functions';

export default async function (tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nx/storybook:storybook',
    (options, projectName) => {
      const projectConfiguration = getProjects(tree).get(projectName);
      const projectRoot = projectConfiguration.root;
      if (options?.['configDir'] === undefined) {
        return;
      }

      const pathToStorybookConfigFile = joinPathFragments(
        options?.['configDir'],
        'tsconfig.json'
      );

      renameAndMoveOldTsConfig(projectRoot, pathToStorybookConfigFile, tree);
    }
  );

  addStorybookToNamedInputs(tree);
  await formatFiles(tree);
}
