import type { Tree } from '@nx/devkit';
import { migrateRemovedExecutors } from '@nx/devkit/internal';

export default function update(tree: Tree) {
  return migrateRemovedExecutors(
    tree,
    [
      '@nx/vite:build',
      '@nx/vite:dev-server',
      '@nx/vite:preview-server',
      '@nrwl/vite:build',
      '@nrwl/vite:dev-server',
      '@nrwl/vite:preview-server',
    ],
    async (tree, options) => {
      const { convertToInferred } =
        require('../../generators/convert-to-inferred/convert-to-inferred') as typeof import('../../generators/convert-to-inferred/convert-to-inferred');
      return convertToInferred(tree, options);
    }
  );
}
