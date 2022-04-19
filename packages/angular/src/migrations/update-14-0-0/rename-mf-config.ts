import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';
import { getMFProjects } from '../../utils/get-mf-projects';

export default function renameMfeConfigToModuleFederation(tree: Tree) {
  const mfProjects = getMFProjects(tree);

  for (const project of mfProjects) {
    const { root, sourceRoot } = readProjectConfiguration(tree, project);
    const pathToOldConfig = joinPathFragments(root, 'mfe.config.js');
    const pathToOldManifest = joinPathFragments(
      sourceRoot,
      'assets/',
      'mfe.manifest.json'
    );
    const pathToMain = joinPathFragments(sourceRoot, 'main.ts');
    if (tree.exists(pathToOldConfig)) {
      tree.rename(
        pathToOldConfig,
        joinPathFragments(root, 'module-federation.config.js')
      );
    }

    if (tree.exists(pathToOldManifest)) {
      tree.rename(
        pathToOldManifest,
        joinPathFragments(
          sourceRoot,
          'assets/',
          'module-federation.config.json'
        )
      );
    }

    if (
      tree.exists(pathToMain) &&
      tree.read(pathToMain, 'utf-8').includes('mfe.manifest.json')
    ) {
      tree.write(
        pathToMain,
        tree
          .read(pathToMain, 'utf-8')
          .replace('mfe.manifest', 'module-federation.manifest')
      );
    }
  }
}
