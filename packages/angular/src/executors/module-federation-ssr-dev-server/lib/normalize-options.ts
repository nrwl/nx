import { workspaceRoot } from '@nx/devkit';
import type { Schema } from '../schema';
import { join } from 'path';

export function normalizeOptions(options: Schema): Schema {
  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  return {
    ...options,
    devRemotes: devServeRemotes,
    ssl: options.ssl ?? false,
    sslCert: options.sslCert ? join(workspaceRoot, options.sslCert) : undefined,
    sslKey: options.sslKey ? join(workspaceRoot, options.sslKey) : undefined,
  };
}
