import {
  getProjects,
  joinPathFragments,
  logger,
  readJson,
  Tree,
  writeJson,
  formatFiles,
} from '@nrwl/devkit';
import { isFramework, TsConfig } from '../../utils/utilities';

export default async function updateStorybookTsconfig(tree: Tree) {
  let changesMade = false;
  const projects = getProjects(tree);

  projects.forEach((projectConfig, projectName) => {
    const targets = projectConfig.targets;

    const paths = {
      tsConfigStorybook: joinPathFragments(
        projectConfig.root,
        '.storybook/tsconfig.json'
      ),
    };

    const storybookExecutor = Object.keys(targets || {}).find(
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
      uiFramework: targets[storybookExecutor]?.options
        ?.uiFramework as Parameters<typeof isFramework>[1]['uiFramework'],
    });

    if (isReactProject) {
      const tsConfig = {
        storybook: readJson<TsConfig>(tree, paths.tsConfigStorybook),
      };

      tsConfig.storybook.compilerOptions = {
        ...tsConfig.storybook.compilerOptions,
        outDir: '',
      };

      writeJson(tree, paths.tsConfigStorybook, tsConfig.storybook);
      changesMade = true;
    }
  });

  if (changesMade) {
    await formatFiles(tree);
  }
}
