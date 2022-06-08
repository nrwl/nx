import type { Tree } from '@nrwl/devkit';
import { changeStorybookTargetsGenerator } from '@nrwl/storybook';

export async function angularChangeStorybookTargestGenerator(tree: Tree) {
  await changeStorybookTargetsGenerator(tree);
}

export default angularChangeStorybookTargestGenerator;
