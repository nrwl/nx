import { type Tree, ensurePackage } from '@nx/devkit';
import { nxVersion } from '../../../../utils/versions';
import { NormalizedSchema, Schema } from '../../schema';

export async function initRspack(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  const { rspackInitGenerator } = ensurePackage('@nx/rspack', nxVersion);
  const rspackInitTask = await rspackInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(rspackInitTask);
}
