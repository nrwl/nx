import type { WebWorkerGeneratorOptions } from '../schema';

export function normalizeOptions(
  options: WebWorkerGeneratorOptions
): WebWorkerGeneratorOptions {
  return {
    ...options,
    snippet: options.snippet ?? true,
  };
}
