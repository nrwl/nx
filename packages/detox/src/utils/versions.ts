export const nxVersion = require('../../package.json').version;

export const detoxVersion = '~20.43.0';
export const testingLibraryJestDom = '~6.9.1';
export const configPluginsDetoxVersion = '~11.0.0'; // only required for expo
// jest-circus + @types/node for the detox jest setup. Kept local (mirrors
// @nx/jest's latestVersions) so this generator doesn't deep-import @nx/jest
// internals, which don't resolve when detox is ensurePackage'd into a temp dir.
export const jestVersion = '~30.3.0';
export const typesNodeVersion = '20.19.9';
