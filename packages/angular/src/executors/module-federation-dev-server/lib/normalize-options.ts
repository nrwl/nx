import type { NormalizedSchema, Schema } from '../schema';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';

export function normalizeOptions(schema: Schema): NormalizedSchema {
  schema.buildLibsFromSource ??= true;
  process.env.NX_BUILD_LIBS_FROM_SOURCE = `${schema.buildLibsFromSource}`;
  process.env.NX_BUILD_TARGET = `${schema.buildTarget}`;

  return {
    ...schema,
    devRemotes: schema.devRemotes ?? [],
    host: schema.host ?? 'localhost',
    port: schema.port ?? 4200,
    liveReload: schema.liveReload ?? true,
    open: schema.open ?? false,
    ssl: schema.ssl ?? false,
    verbose: schema.verbose ?? false,
    sslCert: schema.sslCert ? join(workspaceRoot, schema.sslCert) : undefined,
    sslKey: schema.sslKey ? join(workspaceRoot, schema.sslKey) : undefined,
  };
}
