import { join } from 'path';

export const nxVersion = require(join('@nx/vite', 'package.json')).version;
// Also update @nx/remix/utils/versions when changing vite version
export const viteVersion = '^8.0.0';
export const viteV7Version = '^7.0.0';
export const viteV6Version = '^6.0.0';
export const viteV5Version = '^5.0.0';
// Lowest supported vite major. Kept at v5 because @nx/cypress (v13) still
// installs vite 5; generators throw below this floor via assertSupportedViteVersion.
export const minSupportedViteVersion = '5.0.0';
export const vitePluginReactVersion = '^6.0.0';
export const vitePluginReactV4Version = '^4.2.0';
// Single constants: peer ranges span the whole supported vite window
// (vite-plugin-dts -> `vite: *`, plugin-react-swc -> `vite: ^4..^8`), so no
// per-major map is needed.
export const vitePluginReactSwcVersion = '^4.3.0';
export const vitePluginDtsVersion = '~4.5.0';
export const ajvVersion = '^8.0.0';
export const jitiVersion = '2.4.2';
