import type { Tree } from '@nrwl/devkit';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { mapLintPattern } from '@nrwl/linter/src/generators/lint-project/lint-project';
import type { AddLintingGeneratorSchema } from '../schema';

export function addProjectLintTarget(
  tree: Tree,
  options: AddLintingGeneratorSchema
): void {
  const project = readProjectConfiguration(tree, options.projectName);
  const rootProject = options.projectRoot === '.' || options.projectRoot === '';
  project.targets.lint = {
    executor: '@nrwl/linter:eslint',
    options: {
      lintFilePatterns: [
        mapLintPattern(options.projectRoot, 'ts', rootProject),
        mapLintPattern(options.projectRoot, 'html', rootProject),
      ],
    },
  };
  updateProjectConfiguration(tree, options.projectName, project);
}
