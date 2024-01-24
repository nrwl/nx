import { Tree, formatFiles, getProjects, joinPathFragments } from '@nx/devkit';

/**
 * This migration removes blockList in metro.config.js.
 * It is now excluding dist folder in watchFolders in withNxMetro.
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [_, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      if (tree.exists(joinPathFragments(config.root, 'metro.config.js'))) {
        let content = tree
          .read(joinPathFragments(config.root, 'metro.config.js'))
          .toString();
        content = content.replace(
          'blockList: exclusionList([/^(?!.*node_modules).*/dist/.*/]),',
          ''
        );
        content = content.replace('unstable_enableSymlinks: true,', '');
        content = content.replace('unstable_enablePackageExports: true,', '');
        tree.write(joinPathFragments(config.root, 'metro.config.js'), content);
        await formatFiles(tree);
      }
    }
  }
}
