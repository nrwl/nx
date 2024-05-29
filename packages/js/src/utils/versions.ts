export const nxVersion = require('../../package.json').version;

export const esbuildVersion = '^0.19.2';
export const prettierVersion = '^2.6.2';
export const swcCliVersion = '~0.3.12';
export const swcCoreVersion = '~1.5.7';
export const swcHelpersVersion = '~0.5.11';
export const swcNodeVersion = '~1.9.1';
export const tsLibVersion = '^2.3.0';
export const typesNodeVersion = '18.16.9';
export const verdaccioVersion = '^5.0.4';

// Typescript
export const typescriptVersion = '~5.4.2';
/**
 * The minimum version is currently determined from the lowest version
 * that's supported by the lowest Angular supported version, e.g.
 * `npm view @angular/compiler-cli@14.0.0 peerDependencies.typescript`
 */
export const supportedTypescriptVersions = '>=4.8.2';
