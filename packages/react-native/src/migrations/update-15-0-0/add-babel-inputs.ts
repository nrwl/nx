import { formatFiles, Tree } from '@nrwl/devkit';
import { addBabelInputs } from '@nrwl/js/src/utils/add-babel-inputs';

export default async function (tree: Tree) {
  addBabelInputs(tree);
  await formatFiles(tree);
}
