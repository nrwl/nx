import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(schema: Schema): NormalizedSchema {
  return {
    ...schema,
    host: schema.host ?? 'localhost',
    port: schema.port ?? 4200,
    liveReload: schema.liveReload ?? true,
    hmr: schema.hmr,
    open: schema.open ?? false,
    ssl: schema.ssl ?? false,
    watchDependencies: schema.watchDependencies ?? true,
  };
}
