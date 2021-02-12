import { Tree, formatFiles } from '@nrwl/devkit';
import { addCacheableOperation } from '../../generators/init/init';

export default async function (tree: Tree) {
  addCacheableOperation(tree);
  await formatFiles(tree);
}
