import type { RegisterOptions, Service } from 'ts-node';

export function tsNodeRegister(
  file: string,
  tsConfig?: string,
  tsNodeOptions?: RegisterOptions
): Service | undefined {
  if (!file?.endsWith('.ts')) return;
  // Register TS compiler lazily
  const tsNodeService = require('ts-node').register({
    project: tsConfig,
    compilerOptions: {
      module: 'CommonJS',
      types: ['node'],
    },
    ...tsNodeOptions,
  });

  if (!tsConfig) return tsNodeService;

  // Register paths in tsConfig
  const tsconfigPaths = require('tsconfig-paths');
  const { absoluteBaseUrl: baseUrl, paths } =
    tsconfigPaths.loadConfig(tsConfig);
  if (baseUrl && paths) {
    tsconfigPaths.register({ baseUrl, paths });
  }

  return tsNodeService;
}
