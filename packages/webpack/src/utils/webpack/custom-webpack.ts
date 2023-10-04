import { registerTsProject } from '@nx/js/src/internal';

export function resolveCustomWebpackConfig(path: string, tsConfig: string) {
  const cleanupTranspiler = registerTsProject(tsConfig);
  const customWebpackConfig = require(path);
  cleanupTranspiler();

  // If the user provides a configuration in TS file
  // then there are 2 cases for exporing an object. The first one is:
  // `module.exports = { ... }`. And the second one is:
  // `export default { ... }`. The ESM format is compiled into:
  // `{ default: { ... } }`
  return customWebpackConfig.default || customWebpackConfig;
}

export function isRegistered() {
  return (
    require.extensions['.ts'] != undefined ||
    require.extensions['.tsx'] != undefined
  );
}
