import { Tree } from '@nx/devkit';
import { v2MetaGenerator } from './lib/v2.impl';
import { MetaSchema } from './schema';

export default async function (tree: Tree, schema: MetaSchema) {
  await v2MetaGenerator(tree, schema);
}
