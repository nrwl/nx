import type { Tree } from '@nx/devkit';
import { migrateRemovedExecutors } from '@nx/devkit/internal';

export default function update(tree: Tree) {
  return migrateRemovedExecutors(
    tree,
    [
      '@nx/react-native:build-android',
      '@nx/react-native:build-ios',
      '@nx/react-native:bundle',
      '@nx/react-native:pod-install',
      '@nx/react-native:run-android',
      '@nx/react-native:run-ios',
      '@nx/react-native:start',
      '@nx/react-native:upgrade',
      '@nrwl/react-native:build-android',
      '@nrwl/react-native:build-ios',
      '@nrwl/react-native:bundle',
      '@nrwl/react-native:pod-install',
      '@nrwl/react-native:run-android',
      '@nrwl/react-native:run-ios',
      '@nrwl/react-native:start',
      '@nrwl/react-native:upgrade',
    ],
    async (tree, options) => {
      const { convertToInferred } =
        require('../../generators/convert-to-inferred/convert-to-inferred') as typeof import('../../generators/convert-to-inferred/convert-to-inferred');
      return convertToInferred(tree, options);
    }
  );
}
