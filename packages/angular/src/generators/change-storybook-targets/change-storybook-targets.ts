import type { Tree } from '@nrwl/devkit';
import { ensurePackage, formatFiles } from '@nrwl/devkit';
import { nxVersion } from '../../utils/versions';

import type { Schema } from './schema';

export async function angularChangeStorybookTargestGenerator(
  tree: Tree,
  schema: Schema
) {
  await ensurePackage(tree, '@nrwl/storybook', nxVersion);
  const { changeStorybookTargetsGenerator } = await import('@nrwl/storybook');
  await changeStorybookTargetsGenerator(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default angularChangeStorybookTargestGenerator;
