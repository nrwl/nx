import type { DowngradeModuleGeneratorOptions } from '../schema';

export function normalizeOptions(
  options: DowngradeModuleGeneratorOptions
): DowngradeModuleGeneratorOptions {
  return {
    ...options,
    angularJsImport: options.angularJsImport ?? options.name,
  };
}
