import type { Tree } from '../../generators/tree';
import { updateNxw } from '../../utils/update-nxw.js';

export default async function (tree: Tree) {
  updateNxw(tree);
}
