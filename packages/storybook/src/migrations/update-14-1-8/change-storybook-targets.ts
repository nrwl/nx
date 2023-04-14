import { Tree } from '@nx/devkit';
import { changeStorybookTargetsGenerator } from './change-storybook-targets-generator';

export default async function changeStorybookTargets(tree: Tree) {
  return changeStorybookTargetsGenerator(tree);
}
