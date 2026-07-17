import { assertSupportedInstalledPackageVersion } from '@nx/devkit/internal';
import { minSupportedRspackCoreVersion } from './versions';

export function assertSupportedRspackCoreVersion(): void {
  assertSupportedInstalledPackageVersion(
    '@rspack/core',
    minSupportedRspackCoreVersion
  );
}
