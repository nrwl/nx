import type { Tree } from '@nx/devkit';
import { migrateRemovedExecutors } from '@nx/devkit/internal';

export default function update(tree: Tree) {
  return migrateRemovedExecutors(
    tree,
    [
      '@nx/expo:build',
      '@nx/expo:export',
      '@nx/expo:install',
      '@nx/expo:prebuild',
      '@nx/expo:run',
      '@nx/expo:serve',
      '@nx/expo:start',
      '@nx/expo:submit',
      '@nrwl/expo:build',
      '@nrwl/expo:export',
      '@nrwl/expo:install',
      '@nrwl/expo:prebuild',
      '@nrwl/expo:run',
      '@nrwl/expo:serve',
      '@nrwl/expo:start',
      '@nrwl/expo:submit',
    ],
    async (tree, options) => {
      const { convertToInferred } =
        require('../../generators/convert-to-inferred/convert-to-inferred') as typeof import('../../generators/convert-to-inferred/convert-to-inferred');
      return convertToInferred(tree, options);
    }
  );
}
