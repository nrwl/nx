import type {
  NormalizedSchema,
  Schema,
  SchemaWithBrowserTarget,
  SchemaWithBuildTarget,
} from '../schema';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';

export function normalizeOptions(schema: Schema): NormalizedSchema {
  let buildTarget = (schema as SchemaWithBuildTarget).buildTarget;
  if ((schema as SchemaWithBrowserTarget).browserTarget) {
    buildTarget ??= (schema as SchemaWithBrowserTarget).browserTarget;
    delete (schema as SchemaWithBrowserTarget).browserTarget;
  }
  schema.buildLibsFromSource ??= true;
  process.env.NX_BUILD_LIBS_FROM_SOURCE = `${schema.buildLibsFromSource}`;
  process.env.NX_BUILD_TARGET = `${buildTarget}`;

  return {
    ...schema,
    buildTarget,
    devRemotes: schema.devRemotes ?? [],
    host: schema.host ?? 'localhost',
    port: schema.port ?? 4200,
    liveReload: schema.liveReload ?? true,
    open: schema.open ?? false,
    ssl: schema.ssl ?? false,
    sslCert: schema.sslCert ? join(workspaceRoot, schema.sslCert) : undefined,
    sslKey: schema.sslKey ? join(workspaceRoot, schema.sslKey) : undefined,
  };
}
