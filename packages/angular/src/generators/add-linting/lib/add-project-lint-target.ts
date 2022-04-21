import type { Tree } from '@nrwl/devkit';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import type { AddLintingGeneratorSchema } from '../schema';

export function addProjectLintTarget(
  tree: Tree,
  options: AddLintingGeneratorSchema
): void {
  const project = readProjectConfiguration(tree, options.projectName);
  project.targets.lint = {
    executor: '@nrwl/linter:eslint',
    options: {
      lintFilePatterns: [
        `${options.projectRoot}/**/*.ts`,
        `${options.projectRoot}/**/*.html`,
      ],
    },
  };
  updateProjectConfiguration(tree, options.projectName, project);
}
