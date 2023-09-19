import { homedir } from 'node:os';
import type { Schema } from '../schema';

export function normalizeOptions(schema: Schema): Schema {
  const { ssl, sslCert, sslKey } = schema;

  return {
    host: 'localhost',
    port: 4200,
    liveReload: true,
    open: false,
    ...schema,
    ssl: ssl ?? false,
    ...(sslCert ? { sslCert: sslCert.replace('~', homedir()) } : {}),
    ...(sslKey ? { sslKey: sslKey.replace('~', homedir()) } : {}),
  };
}
