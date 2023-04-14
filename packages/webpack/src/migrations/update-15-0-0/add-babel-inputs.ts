import { formatFiles, Tree } from '@nx/devkit';
import { addBabelInputs } from '@nx/js/src/utils/add-babel-inputs';

export default async function (tree: Tree) {
  addBabelInputs(tree);
  await formatFiles(tree);
}
