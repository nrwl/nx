import type { Tree } from '@nrwl/devkit';
import { readProjectConfiguration } from '@nrwl/devkit';

export function checkProjectTestTarget(tree: Tree, project: string): void {
  const projectConfig = readProjectConfiguration(tree, project);
  if (projectConfig.targets.test) {
    throw new Error(`"${project}" already has a test target.`);
  }
}
