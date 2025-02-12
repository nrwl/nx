export const nxVersion = require('../../package.json').version;
export const rsbuildVersion = '1.1.10';
export const rsbuildPluginReactVersion = '1.1.0';
export const rsbuildPluginVueVersion = '1.0.5';
export const rsbuildPluginSassVersion = '1.1.2';
export const rsbuildPluginLessVersion = '1.1.0';
export const rsbuildPluginStyledComponentsVersion = '1.1.0';

/**
 * These versions need to line up with the version of the swc_core crate Rspack uses for the version of Rsbuild above
 * Checking the `cargo.toml` at https://github.com/web-infra-dev/rspack/blob/main/Cargo.toml for the correct Rspack version
 * is the best way to ensure that these versions are correct.
 *
 * The release notes for the packages below are very helpful in understanding what version of swc_core crate they require.
 */
export const rsbuildSwcPluginEmotionVersion = '^7.0.3';
export const rsbuildSwcPluginStyledJsxVersion = '^5.0.2';
