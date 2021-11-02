import type { UpgradeModuleGeneratorOptions } from '../schema';

export function normalizeOptions(
  options: UpgradeModuleGeneratorOptions
): UpgradeModuleGeneratorOptions {
  return {
    ...options,
    angularJsImport: options.angularJsImport ?? options.name,
    angularJsCmpSelector: options.angularJsCmpSelector ?? undefined,
  };
}
