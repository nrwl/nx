import { formatFiles, Tree } from '@nx/devkit';
import { addGitIgnoreEntry } from '../../utils/add-gitignore-entry';

export async function update(tree: Tree) {
  addGitIgnoreEntry(tree);
  await formatFiles(tree);
}

export default update;
