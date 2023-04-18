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

  const project = readProjectConfiguration(tree, options.projectName);
  project.targets.build = {
    executor: '@nx/js:tsc',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath:
        options.libsDir && options.libsDir !== '.'
          ? `dist/${options.libsDir}/${options.projectDirectory}`
          : `dist/${options.projectDirectory}`,
      tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
      packageJson: `${options.projectRoot}/package.json`,
      main: `${options.projectRoot}/src/index.ts`,
      assets: [`${options.projectRoot}/*.md`],
    },
  };
  updateProjectConfiguration(tree, options.projectName, project);
}
