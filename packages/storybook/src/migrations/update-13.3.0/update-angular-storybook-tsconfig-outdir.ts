import {
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readJson,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import * as path from 'path';
import { isFramework, TsConfig } from '../../utils/utilities';

/**
 * Migration that adds the outDir property to the compilerOptions in the Storybook configuration.
 * It will look up all Storybook Projects and update only the one using Angular as uiFramework.
 * @param tree virtual file system tree representing the physical file system we want to modify
 */
export default async function addOutDirToAngularStorybookTsconfig(tree: Tree) {
  let changesMade = false;
  const projects = getProjects(tree);

  projects.forEach((projectConfig, projectName) => {
    const targets = projectConfig.targets;
    const storybookRoot = path.join(projectConfig.root, '.storybook');

    const paths = {
      tsConfigStorybook: joinPathFragments(
        projectConfig.root,
        '.storybook/tsconfig.json'
      ),
    };

    const storybookExecutor =
      targets &&
      Object.keys(targets).find(
        (x) => targets[x].executor === '@nrwl/storybook:storybook'
      );

    const hasStorybookConfig =
      storybookExecutor && tree.exists(paths.tsConfigStorybook);

    if (!hasStorybookConfig) {
      logger.info(
        `${projectName}: no storybook configured. skipping migration...`
      );
      return;
    }

    const isAngularProject = isFramework('angular', {
      uiFramework: targets[storybookExecutor].options
        ?.uiFramework as Parameters<typeof isFramework>[1]['uiFramework'],
    });

    if (isAngularProject) {
      const tsConfig = {
        storybook: readJson<TsConfig>(tree, paths.tsConfigStorybook),
      };

      tsConfig.storybook.compilerOptions.outDir = `${offsetFromRoot(
        storybookRoot
      )}dist/out-tsc`;

      writeJson(tree, paths.tsConfigStorybook, tsConfig.storybook);
      changesMade = true;
    }
  });

  if (changesMade) {
    await formatFiles(tree);
  }
}
