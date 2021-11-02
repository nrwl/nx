export function tsNodeRegister(file: string = '', tsConfig?: string) {
  if (file && file.endsWith('.ts')) {
    // Register TS compiler lazily
    require('ts-node').register({
      project: tsConfig,
      compilerOptions: {
        module: 'CommonJS',
        types: ['node'],
      },
    });

    // Register paths in tsConfig
    const tsconfigPaths = require('tsconfig-paths');
    const { absoluteBaseUrl: baseUrl, paths } =
      tsconfigPaths.loadConfig(tsConfig);
    if (baseUrl && paths) {
      tsconfigPaths.register({ baseUrl, paths });
    }
  }
}
