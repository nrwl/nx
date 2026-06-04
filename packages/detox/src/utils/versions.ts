import { join } from 'path';

export const nxVersion = require(join('@nx/detox', 'package.json')).version;

// Detox's only maintained major is 20.x; v19 has had no upstream patches since
// detox@20 (2022-11-10). The plugin is v20-only.
export const minSupportedDetoxVersion = '20.0.0';

export const detoxVersion = '~20.43.0';
export const testingLibraryJestDom = '~6.9.1';
export const configPluginsDetoxVersion = '~11.0.0'; // only required for expo
