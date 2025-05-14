import { getInstalledAngularVersionInfo } from '../../../executors/utilities/angular-version-utils';
import type {
  NormalizedSchema,
  Schema,
  SchemaWithBrowserTarget,
  SchemaWithBuildTarget,
} from '../schema';

export function normalizeOptions(schema: Schema): NormalizedSchema {
  let buildTarget = (schema as SchemaWithBuildTarget).buildTarget;
  if ((schema as SchemaWithBrowserTarget).browserTarget) {
    buildTarget ??= (schema as SchemaWithBrowserTarget).browserTarget;
    delete (schema as SchemaWithBrowserTarget).browserTarget;
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();

  return {
    ...schema,
    buildTarget,
    host: schema.host ?? 'localhost',
    port: schema.port ?? 4200,
    liveReload: schema.liveReload ?? true,
    hmr: schema.hmr ?? (angularMajorVersion < 19 ? false : undefined),
    open: schema.open ?? false,
    ssl: schema.ssl ?? false,
    watchDependencies: schema.watchDependencies ?? true,
  };
}
