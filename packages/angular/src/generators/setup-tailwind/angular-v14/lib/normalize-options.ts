import type { GeneratorOptions, NormalizedGeneratorOptions } from '../schema';

export function normalizeOptions(
  options: GeneratorOptions
): NormalizedGeneratorOptions {
  return {
    ...options,
    buildTarget: options.buildTarget || 'build',
  };
}
