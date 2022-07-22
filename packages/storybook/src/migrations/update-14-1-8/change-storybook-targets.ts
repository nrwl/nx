import { Tree } from '@nrwl/devkit';
import { changeStorybookTargetsGenerator } from '../../generators/change-storybook-targets/change-storybook-targets';

export default async function changeStorybookTargets(tree: Tree) {
  return changeStorybookTargetsGenerator(tree);
}
