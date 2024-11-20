import { Tree } from '@nx/devkit';
import { addViteTempFilesToGitIgnore as _addViteTempFilesToGitIgnore } from '../../utils/add-vite-temp-files-to-gitignore';

export default function addViteTempFilesToGitIgnore(tree: Tree) {
  // need to check if .gitignore exists before adding to it
  // then need to check if it contains the following pattern
  // **/vite.config.{js,ts,mjs,mts,cjs,cts}.timestamp*
  // if it does, remove just this pattern
  if (tree.exists('.gitignore')) {
    const gitIgnoreContents = tree.read('.gitignore', 'utf-8');
    if (
      gitIgnoreContents.includes(
        '**/vite.config.{js,ts,mjs,mts,cjs,cts}.timestamp*'
      )
    ) {
      tree.write(
        '.gitignore',
        gitIgnoreContents.replace(
          '**/vite.config.{js,ts,mjs,mts,cjs,cts}.timestamp*',
          ''
        )
      );
    }
  }
  _addViteTempFilesToGitIgnore(tree);
}
