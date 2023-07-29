import { readProjectConfiguration, Tree } from '@nx/devkit';
import { NormalizedJestProjectSchema } from '../schema';

export function checkForTestTarget(
  tree: Tree,
  options: NormalizedJestProjectSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (projectConfig?.targets?.test) {
    throw new Error(`${options.project}: already has a test target set.`);
  }
}
