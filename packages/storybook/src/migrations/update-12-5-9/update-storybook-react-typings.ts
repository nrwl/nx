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

export default async function addReactTypings(tree: Tree) {
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

    const storybookExecutor = Object.keys(targets).find(
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

    const isReactProject = isFramework('react', {
      uiFramework: targets[storybookExecutor].options
        ?.uiFramework as Parameters<typeof isFramework>[1]['uiFramework'],
    });

    if (isReactProject) {
      const tsConfig = {
        storybook: readJson<TsConfig>(tree, paths.tsConfigStorybook),
      };

      tsConfig.storybook.files = tsConfig.storybook.files || [];
      tsConfig.storybook.files = uniqueArray([
        ...tsConfig.storybook.files,
        `${offsetFromRoot(
          storybookRoot
        )}node_modules/@nrwl/react/typings/cssmodule.d.ts`,
        `${offsetFromRoot(
          storybookRoot
        )}node_modules/@nrwl/react/typings/image.d.ts`,
      ]);

      writeJson(tree, paths.tsConfigStorybook, tsConfig.storybook);
      changesMade = true;
    }
  });

  if (changesMade) {
    await formatFiles(tree);
  }
}

function uniqueArray<T extends Array<any>>(value: T) {
  return [...new Set(value)] as T;
}
