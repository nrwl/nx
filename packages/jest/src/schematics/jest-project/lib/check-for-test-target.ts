import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { JestProjectSchema } from '../schema';

export function checkForTestTarget(tree: Tree, options: JestProjectSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (projectConfig.targets.test) {
    throw new Error(`${options.project}: already has a test architect option.`);
  }
}
