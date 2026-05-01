import type { Tree } from '@nx/devkit';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function addProject(tree: Tree, options: NormalizedOptions): void {
  if (!options.publishable && !options.buildable) {
    return;
  }

  // For TS solution setup, the build target is inferred by @nx/js/typescript plugin.
  // The @nx/js:library generator already handles setting up the correct configuration.
  if (options.isUsingTsSolutionsConfig) {
    return;
  }

  // For non-TS solution setup, add the build target with the correct output path
  const project = readProjectConfiguration(tree, options.projectName);
  project.targets ??= {};
  project.targets.build = {
    executor: '@nx/js:tsc',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: `dist/${options.projectRoot}`,
      tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
      packageJson: `${options.projectRoot}/package.json`,
      main: `${options.projectRoot}/src/index.ts`,
      assets: [`${options.projectRoot}/*.md`],
    },
  };
  updateProjectConfiguration(tree, options.projectName, project);
}
