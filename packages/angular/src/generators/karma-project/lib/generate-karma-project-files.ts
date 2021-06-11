import type { Tree } from '@nrwl/devkit';
import {
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
} from '@nrwl/devkit';

export function generateKarmaProjectFiles(tree: Tree, project: string): void {
  const projectConfig = readProjectConfiguration(tree, project);
  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    projectConfig.root,
    {
      tmpl: '',
      projectRoot: projectConfig.root,
      isLibrary: projectConfig.projectType === 'library',
      offsetFromRoot: offsetFromRoot(projectConfig.root),
    }
  );
}
