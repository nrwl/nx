import { Tree } from '../../generators/tree';
import { updateNxw } from '../../utils/update-nxw';

export default async function (tree: Tree) {
  updateNxw(tree);
}
