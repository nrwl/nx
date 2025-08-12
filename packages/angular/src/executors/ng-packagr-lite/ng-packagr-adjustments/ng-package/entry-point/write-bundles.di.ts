import type { TransformProvider } from 'ng-packagr/src/lib/graph/transform.di';
import { getNgPackagrVersionInfo } from '../../../../utilities/ng-packagr/ng-packagr-version';
import { importNgPackagrPath } from '../../../../utilities/ng-packagr/package-imports';
import { writeBundlesTransform } from './write-bundles.transform';

export function getWriteBundlesTransformProvider(): TransformProvider {
  const { major: ngPackagrMajorVersion } = getNgPackagrVersionInfo();

  const { provideTransform } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/graph/transform.di')
  >('ng-packagr/src/lib/graph/transform.di', ngPackagrMajorVersion);
  const { WRITE_BUNDLES_TRANSFORM_TOKEN } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/entry-point/write-bundles.di')
  >(
    'ng-packagr/src/lib/ng-package/entry-point/write-bundles.di',
    ngPackagrMajorVersion
  );
  const { OPTIONS_TOKEN } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/options.di')
  >('ng-packagr/src/lib/ng-package/options.di', ngPackagrMajorVersion);

  return provideTransform({
    provide: WRITE_BUNDLES_TRANSFORM_TOKEN,
    useFactory: writeBundlesTransform,
    deps: [OPTIONS_TOKEN],
  });
}
