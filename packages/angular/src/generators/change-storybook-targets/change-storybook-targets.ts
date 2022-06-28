import type { Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { changeStorybookTargetsGenerator } from '@nrwl/storybook';

import type { Schema } from './schema';

export async function angularChangeStorybookTargestGenerator(
  tree: Tree,
  schema: Schema
) {
  await changeStorybookTargetsGenerator(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default angularChangeStorybookTargestGenerator;
