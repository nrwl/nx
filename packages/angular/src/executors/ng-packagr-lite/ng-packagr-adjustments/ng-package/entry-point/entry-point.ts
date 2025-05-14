import type {
  DestinationFiles,
  NgEntryPoint as NgEntryPointBase,
} from 'ng-packagr/src/lib/ng-package/entry-point/entry-point';
import type { NgPackageConfig } from 'ng-packagr/src/ng-package.schema';
import { dirname, join, relative } from 'node:path';
import { getNgPackagrVersionInfo } from '../../../../utilities/ng-packagr/ng-packagr-version';
import { importNgPackagrPath } from '../../../../utilities/ng-packagr/package-imports';

export type NgEntryPointType = NgEntryPointBase & {
  primaryDestinationPath?: string;
};

export function createNgEntryPoint(
  packageJson: Record<string, any>,
  ngPackageJson: NgPackageConfig,
  basePath: string,
  secondaryData?: Record<string, any>
): NgEntryPointType {
  const { major: ngPackagrMajorVersion } = getNgPackagrVersionInfo();

  const { NgEntryPoint: NgEntryPointBase } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/entry-point/entry-point')
  >(
    'ng-packagr/src/lib/ng-package/entry-point/entry-point',
    ngPackagrMajorVersion
  );

  if (ngPackagrMajorVersion < 20) {
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

    return new NgEntryPoint(
      packageJson,
      ngPackageJson,
      basePath,
      secondaryData
    );
  }

  const { ensureUnixPath } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/utils/path')
  >('ng-packagr/src/lib/utils/path', ngPackagrMajorVersion);

  class NgEntryPoint extends NgEntryPointBase {
    constructor(
      public readonly packageJson: Record<string, any>,
      public readonly ngPackageJson: NgPackageConfig,
      public readonly basePath: string,
      private readonly _secondaryData?: Record<string, any>
    ) {
      super(packageJson, ngPackageJson, basePath, _secondaryData);
    }

    public get primaryDestinationPath(): string {
      return (
        this._secondaryData?.primaryDestinationPath ?? this.destinationPath
      );
    }

    public get destinationFiles(): DestinationFiles {
      let primaryDestPath = this.destinationPath;
      let secondaryDir = '';

      if (this._secondaryData) {
        primaryDestPath = this._secondaryData.primaryDestinationPath;
        secondaryDir = relative(
          primaryDestPath,
          this._secondaryData.destinationPath
        );
      }

      const flatModuleFile = this.flatModuleFile;
      const pathJoinWithDest = (...paths: string[]) =>
        join(primaryDestPath, ...paths);

      return {
        directory: ensureUnixPath(secondaryDir),
        declarations: pathJoinWithDest(
          'tmp-typings',
          secondaryDir,
          `${flatModuleFile}.d.ts`
        ),
        // changed to use esm2022
        declarationsBundled: pathJoinWithDest(
          'esm2022',
          secondaryDir,
          `${flatModuleFile}.d.ts`
        ),
        declarationsDir: pathJoinWithDest(secondaryDir),
        esm2022: pathJoinWithDest(
          'tmp-esm2022',
          secondaryDir,
          `${flatModuleFile}.js`
        ),
        // changed to use esm2022
        fesm2022: pathJoinWithDest(
          'esm2022',
          secondaryDir,
          `${flatModuleFile}.js`
        ),
        // changed to use esm2022
        fesm2022Dir: pathJoinWithDest('esm2022'),
      };
    }
  }

  return new NgEntryPoint(packageJson, ngPackageJson, basePath, secondaryData);
}
