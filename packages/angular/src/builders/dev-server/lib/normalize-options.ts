import { getInstalledAngularVersionInfo } from '../../../executors/utilities/angular-version-utils';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(schema: Schema): NormalizedSchema {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();

  return {
    ...schema,
    host: schema.host ?? 'localhost',
    port: schema.port ?? 4200,
    liveReload: schema.liveReload ?? true,
    hmr: schema.hmr ?? (angularMajorVersion < 19 ? false : undefined),
    open: schema.open ?? false,
    ssl: schema.ssl ?? false,
    watchDependencies: schema.watchDependencies ?? true,
  };
}
