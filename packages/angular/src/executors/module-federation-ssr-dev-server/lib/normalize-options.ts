import { Schema } from '../schema';

export function normalizeOptions(options: Schema): Schema {
  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  return {
    ...options,
    devRemotes: devServeRemotes,
    isInitialHost: options.isInitialHost ?? options.host === undefined,
  };
}
