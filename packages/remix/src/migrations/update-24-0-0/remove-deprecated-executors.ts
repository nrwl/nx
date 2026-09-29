import type { Tree } from '@nx/devkit';
import { migrateRemovedExecutors } from '@nx/devkit/internal';

export default function update(tree: Tree) {
  return migrateRemovedExecutors(
    tree,
    [
      '@nx/remix:build',
      '@nx/remix:serve',
      '@nrwl/remix:build',
      '@nrwl/remix:serve',
    ],
    async (tree, options) => {
      const { convertToInferred } =
        require('../../generators/convert-to-inferred/convert-to-inferred') as typeof import('../../generators/convert-to-inferred/convert-to-inferred');
      return convertToInferred(tree, options);
    }
  );
}
