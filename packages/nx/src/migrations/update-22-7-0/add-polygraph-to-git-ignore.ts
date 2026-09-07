import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { Tree } from '../../generators/tree';
import { addEntryToGitIgnore } from '../../utils/ignore';

export default async function addPolygraphToGitIgnore(tree: Tree) {
  if (!tree.exists('.gitignore')) {
    return;
  }
  // Lerna users that don't use nx.json may not expect .nx directory changes
  if (tree.exists('lerna.json') && !tree.exists('nx.json')) {
    return;
  }
  addEntryToGitIgnore(tree, '.gitignore', '.nx/polygraph');

  await formatChangedFiles(tree);
}
