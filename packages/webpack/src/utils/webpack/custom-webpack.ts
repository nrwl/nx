import { tsNodeRegister } from '@nx/js/src/utils/typescript/tsnode-register';

export function resolveCustomWebpackConfig(path: string, tsConfig: string) {
  const tsNodeService = tsNodeRegister(path, tsConfig);

  const customWebpackConfig = require(path);

  if (tsNodeService) {
    tsNodeService.enabled(false);
  }

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
