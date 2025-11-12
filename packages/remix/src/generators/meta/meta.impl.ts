import { Tree } from '@nx/devkit';
import { v2MetaGenerator } from './lib/v2.impl.js';
import { MetaSchema } from './schema.js';

export default async function (tree: Tree, schema: MetaSchema) {
  await v2MetaGenerator(tree, schema);
}
