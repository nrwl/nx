import { merge } from 'webpack-merge';

export async function mergeCustomWebpackConfig(
  baseWebpackConfig: any,
  pathToWebpackConfig: string,
  options: { tsConfig: string; [k: string]: any },
  target: import('@angular-devkit/architect').Target
) {
  const customWebpackConfiguration = resolveCustomWebpackConfig(
    pathToWebpackConfig,
    options.tsConfig
  );
  // The extra Webpack configuration file can also export a Promise, for instance:
  // `module.exports = new Promise(...)`. If it exports a single object, but not a Promise,
  // then await will just resolve that object.
  const config = await customWebpackConfiguration;

  // The extra Webpack configuration file can export a synchronous or asynchronous function,
  // for instance: `module.exports = async config => { ... }`.
  if (typeof config === 'function') {
    return config(baseWebpackConfig, options, target);
  } else {
    return merge(baseWebpackConfig, config);
  }
}

export function resolveCustomWebpackConfig(path: string, tsConfig: string) {
  tsNodeRegister(path, tsConfig);

  const customWebpackConfig = require(path);
  // If the user provides a configuration in TS file
  // then there are 2 cases for exporting an object. The first one is:
  // `module.exports = { ... }`. And the second one is:
  // `export default { ... }`. The ESM format is compiled into:
  // `{ default: { ... } }`
  return customWebpackConfig.default ?? customWebpackConfig;
}

export function resolveIndexHtmlTransformer(
  path: string,
  tsConfig: string,
  target: import('@angular-devkit/architect').Target
) {
  tsNodeRegister(path, tsConfig);

  const indexTransformer = require(path);
  const transform = indexTransformer.default ?? indexTransformer;

  return (indexHtml) => transform(target, indexHtml);
}

function tsNodeRegister(file: string, tsConfig?: string) {
  if (!file?.endsWith('.ts')) return;
  // Register TS compiler lazily
  require('ts-node').register({
    project: tsConfig,
    compilerOptions: {
      module: 'CommonJS',
      types: ['node'],
    },
  });

  if (!tsConfig) return;

  // Register paths in tsConfig
  const tsconfigPaths = require('tsconfig-paths');
  const { absoluteBaseUrl: baseUrl, paths } =
    tsconfigPaths.loadConfig(tsConfig);
  if (baseUrl && paths) {
    tsconfigPaths.register({ baseUrl, paths });
  }
}
