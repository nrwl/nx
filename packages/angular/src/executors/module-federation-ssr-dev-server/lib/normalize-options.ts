import { workspaceRoot } from '@nx/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import { join } from 'path';

export function normalizeOptions(options: Schema): NormalizedSchema {
  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  return {
    ...options,
    devRemotes: devServeRemotes,
    verbose: options.verbose ?? false,
    ssl: options.ssl ?? false,
    sslCert: options.sslCert ? join(workspaceRoot, options.sslCert) : undefined,
    sslKey: options.sslKey ? join(workspaceRoot, options.sslKey) : undefined,
  };
}
