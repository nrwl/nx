import { NgPackagr, ngPackagr } from 'ng-packagr';
import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';

export async function getNgPackagrInstance(): Promise<NgPackagr> {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();
  if (angularMajorVersion >= 19) {
    const { STYLESHEET_PROCESSOR } = await import(
      '../../utilities/ng-packagr/stylesheet-processor.di.js'
    );

    const packagr = ngPackagr();
    packagr.withProviders([STYLESHEET_PROCESSOR]);

    return packagr;
  }

  const { WRITE_BUNDLES_TRANSFORM } = await import(
    './pre-v19/ng-package/entry-point/write-bundles.di.js'
  );
  const { WRITE_PACKAGE_TRANSFORM } = await import(
    './pre-v19/ng-package/entry-point/write-package.di.js'
  );
  const { STYLESHEET_PROCESSOR } = await import(
    '../../utilities/ng-packagr/stylesheet-processor.di.js'
  );

  const packagr = ngPackagr();
  packagr.withProviders([
    WRITE_BUNDLES_TRANSFORM,
    WRITE_PACKAGE_TRANSFORM,
    STYLESHEET_PROCESSOR,
  ]);

  return packagr;
}
