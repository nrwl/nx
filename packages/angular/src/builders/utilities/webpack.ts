import { merge } from 'webpack-merge';
import { registerTsProject } from '@nx/js/src/internal';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

export async function mergeCustomWebpackConfig(
  baseWebpackConfig: any,
  pathToWebpackConfig: string,
  options: { tsConfig: string; [k: string]: any },
  target: import('@angular-devkit/architect').Target
) {
  const customWebpackConfiguration = resolveCustomWebpackConfig(
    pathToWebpackConfig,
    options.tsConfig.startsWith(workspaceRoot)
      ? options.tsConfig
      : join(workspaceRoot, options.tsConfig)
  );
  // The extra Webpack configuration file can also export a Promise, for instance:
  // `module.exports = new Promise(...)`. If it exports a single object, but not a Promise,
  // then await will just resolve that object.
  const config = await customWebpackConfiguration;

  let newConfig: any;
  if (typeof config === 'function') {
    // The extra Webpack configuration file can export a synchronous or asynchronous function,
    // for instance: `module.exports = async config => { ... }`.
    newConfig = await config(baseWebpackConfig, options, target);
  } else {
    newConfig = merge(baseWebpackConfig, config);
  }

  // license-webpack-plugin will at times try to scan the monorepo's root package.json
  // This will result in an error being thrown
  // Ensure root package.json is excluded
  const licensePlugin = newConfig.plugins.find(
    (p) => p.constructor.name === 'LicenseWebpackPlugin'
  );
  if (licensePlugin) {
    let rootPackageJsonName: string;
    const pathToRootPackageJson = join(
      newConfig.context.root ?? workspaceRoot,
      'package.json'
    );
    if (existsSync(pathToRootPackageJson)) {
      try {
        const rootPackageJson = JSON.parse(
          readFileSync(pathToRootPackageJson, 'utf-8')
        );
        rootPackageJsonName = rootPackageJson.name;
        licensePlugin.pluginOptions.excludedPackageTest = (pkgName: string) => {
          if (!rootPackageJsonName) {
            return false;
          }
          return pkgName === rootPackageJsonName;
        };
      } catch {
        // do nothing
      }
    }
  }

  return newConfig;
}

export function resolveCustomWebpackConfig(path: string, tsConfig: string) {
  const cleanupTranspiler = registerTsProject(tsConfig);
  const customWebpackConfig = require(path);
  cleanupTranspiler();
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
  const cleanupTranspiler = registerTsProject(tsConfig);
  const indexTransformer = require(path);
  cleanupTranspiler();

  const transform = indexTransformer.default ?? indexTransformer;

  return (indexHtml) => transform(target, indexHtml);
}
