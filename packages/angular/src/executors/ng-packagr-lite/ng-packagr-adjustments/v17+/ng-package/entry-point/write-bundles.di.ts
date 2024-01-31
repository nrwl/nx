import {
  TransformProvider,
  provideTransform,
} from 'ng-packagr/lib/graph/transform.di';
import { WRITE_BUNDLES_TRANSFORM_TOKEN } from 'ng-packagr/lib/ng-package/entry-point/write-bundles.di';
import { OPTIONS_TOKEN } from 'ng-packagr/lib/ng-package/options.di';
import { writeBundlesTransform } from './write-bundles.transform';

export const WRITE_BUNDLES_TRANSFORM: TransformProvider = provideTransform({
  provide: WRITE_BUNDLES_TRANSFORM_TOKEN,
  useFactory: writeBundlesTransform,
  deps: [OPTIONS_TOKEN],
});
