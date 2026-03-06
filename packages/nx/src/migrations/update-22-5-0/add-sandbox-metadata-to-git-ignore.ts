import { Tree } from '../../generators/tree';
import { addEntryToGitIgnore } from '../../utils/ignore';

export default function addSandboxMetadataToGitIgnore(tree: Tree) {
  if (!tree.exists('.gitignore')) {
    return;
  }
  if (tree.exists('lerna.json') && !tree.exists('nx.json')) {
    return;
  }
  addEntryToGitIgnore(tree, '.gitignore', '.nx/sandbox-metadata');
}
