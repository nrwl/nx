import { Tree } from '../../generators/tree';
import { addEntryToGitIgnore } from '../../utils/ignore';

export default function addPolygraphToGitIgnore(tree: Tree) {
  if (!tree.exists('.gitignore')) {
    return;
  }
  addEntryToGitIgnore(tree, '.gitignore', '.nx/polygraph');
}
