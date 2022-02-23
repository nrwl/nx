import type { Schema } from '../schema';

export function normalizeOptions(schema: Schema): Schema {
  return {
    host: 'localhost',
    port: 4200,
    liveReload: true,
    open: false,
    ssl: false,
    additionalConfigurations: [],
    ...schema,
  };
}
