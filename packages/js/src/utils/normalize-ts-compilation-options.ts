import { TypeScriptCompilationOptions } from '@nrwl/workspace/src/utilities/typescript';

export function normalizeTsCompilationOptions(
  options: TypeScriptCompilationOptions
): TypeScriptCompilationOptions {
  return {
    ...options,
    deleteOutputPath: options.deleteOutputPath ?? true,
    rootDir: options.rootDir ?? options.projectRoot,
  };
}
