import { Tree } from '@nx/devkit';
import { v2MetaGenerator } from './lib/v2.impl';
import { MetaSchema } from './schema';
import { assertSupportedRemixVersion } from '../../utils/versions';

export default async function (tree: Tree, schema: MetaSchema) {
  assertSupportedRemixVersion(tree);

  await v2MetaGenerator(tree, schema);
}
