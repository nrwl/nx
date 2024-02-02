import { NgPackagr, ngPackagr } from 'ng-packagr';
import type { BuildAngularLibraryExecutorOptions } from '../../package/schema';
import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import { STYLESHEET_PROCESSOR } from '../../utilities/ng-packagr/stylesheet-processor.di';

export async function getNgPackagrInstance(
  options: BuildAngularLibraryExecutorOptions
): Promise<NgPackagr> {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();
  if (angularMajorVersion >= 17) {
    const packagr = ngPackagr();
    packagr.withProviders([STYLESHEET_PROCESSOR]);
    return packagr;
  }

  const { NX_ENTRY_POINT_PROVIDERS } = await import(
    './ng-package/entry-point/entry-point.di'
  );
  const { nxProvideOptions } = await import('./ng-package/options.di');
  const { NX_PACKAGE_PROVIDERS, NX_PACKAGE_TRANSFORM } = await import(
    './ng-package/package.di'
  );

  const packagr = new NgPackagr([
    ...NX_PACKAGE_PROVIDERS,
    ...NX_ENTRY_POINT_PROVIDERS,
    nxProvideOptions({
      tailwindConfig: options.tailwindConfig,
      watch: options.watch,
    }),
  ]);
  packagr.withBuildTransform(NX_PACKAGE_TRANSFORM.provide);

  return packagr;
}
