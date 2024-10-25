import { Tree } from '@nx/devkit';
import { addViteTempFilesToGitIgnore as _addViteTempFilesToGitIgnore } from '../../utils/add-vite-temp-files-to-gitignore';

export default function addViteTempFilesToGitIgnore(tree: Tree) {
  _addViteTempFilesToGitIgnore(tree);
}
