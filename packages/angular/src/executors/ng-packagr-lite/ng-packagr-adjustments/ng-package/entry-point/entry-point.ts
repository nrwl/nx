import type {
  DestinationFiles,
  NgEntryPoint as NgEntryPointBase,
} from 'ng-packagr/src/lib/ng-package/entry-point/entry-point';
import type { NgPackageConfig } from 'ng-packagr/src/ng-package.schema';
import { dirname } from 'node:path';
import { getNgPackagrVersionInfo } from '../../../../utilities/ng-packagr/ng-packagr-version';
import { importNgPackagrPath } from '../../../../utilities/ng-packagr/package-imports';

export function createNgEntryPoint(
  packageJson: Record<string, any>,
  ngPackageJson: NgPackageConfig,
  basePath: string,
  secondaryData?: Record<string, any>
): NgEntryPointBase {
  const { major: ngPackagrMajorVersion } = getNgPackagrVersionInfo();

  const { NgEntryPoint: NgEntryPointBase } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/entry-point/entry-point')
  >(
    'ng-packagr/src/lib/ng-package/entry-point/entry-point',
    ngPackagrMajorVersion
  );

  class NgEntryPoint extends NgEntryPointBase {
    /**
     * Point the FESM2022 files to the ESM2022 files.
     */
    public override get destinationFiles(): DestinationFiles {
      const result = super.destinationFiles;
      result.fesm2022 = result.esm2022;
      result.fesm2022Dir = dirname(result.esm2022);

      return result;
    }
  }

  return new NgEntryPoint(packageJson, ngPackageJson, basePath, secondaryData);
}
