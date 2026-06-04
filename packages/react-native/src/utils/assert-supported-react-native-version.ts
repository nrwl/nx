import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedReactNativeVersion } from './versions';

export function assertSupportedReactNativeVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    'react-native',
    minSupportedReactNativeVersion
  );
}
