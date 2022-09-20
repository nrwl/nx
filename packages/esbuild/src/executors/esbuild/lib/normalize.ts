import { EsBuildExecutorOptions } from '../schema';
export function normalizeOptions(
  options: EsBuildExecutorOptions
): EsBuildExecutorOptions {
  return {
    ...options,
    outputFileName: options.outputFileName ?? 'main.js',
  };
}
