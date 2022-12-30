export function tsNodeRegister(file: string = '', tsConfig?: string) {
  if (!file?.endsWith('.ts')) return;
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

export function resolveCustomWebpackConfig(path: string, tsConfig: string) {
  tsNodeRegister(path, tsConfig);

  const customWebpackConfig = require(path);
  // If the user provides a configuration in TS file
  // then there are 2 cases for exporing an object. The first one is:
  // `module.exports = { ... }`. And the second one is:
  // `export default { ... }`. The ESM format is compiled into:
  // `{ default: { ... } }`
  return customWebpackConfig.default || customWebpackConfig;
}
