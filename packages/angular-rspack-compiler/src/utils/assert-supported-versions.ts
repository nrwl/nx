import { assertSupportedInstalledPackageVersion } from '@nx/devkit/internal';
import {
  minSupportedAngularBuildVersion,
  minSupportedRsbuildCoreVersion,
} from './versions';

export function assertSupportedAngularRspackCompilerVersions(): void {
  assertSupportedInstalledPackageVersion(
    '@angular/build',
    minSupportedAngularBuildVersion
  );
  assertSupportedInstalledPackageVersion(
    '@rsbuild/core',
    minSupportedRsbuildCoreVersion
  );
}
