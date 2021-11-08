import { InjectionToken } from 'injection-js';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import {
  provideTransform,
  TransformProvider,
} from 'ng-packagr/lib/graph/transform.di';
import { OPTIONS_TOKEN } from 'ng-packagr/lib/ng-package/options.di';
import { nxWritePackageTransform } from './write-package';

export const NX_WRITE_PACKAGE_TRANSFORM_TOKEN = new InjectionToken<Transform>(
  `nx.v1.writePackageTransform`
);
export const NX_WRITE_PACKAGE_TRANSFORM: TransformProvider = provideTransform({
  provide: NX_WRITE_PACKAGE_TRANSFORM_TOKEN,
  useFactory: nxWritePackageTransform,
  deps: [OPTIONS_TOKEN],
});
