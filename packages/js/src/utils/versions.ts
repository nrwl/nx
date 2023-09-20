export const nxVersion = require('../../package.json').version;

export const esbuildVersion = '^0.17.17';
export const prettierVersion = '^2.6.2';
export const swcCliVersion = '~0.1.62';
export const swcCoreVersion = '~1.3.51';
export const swcHelpersVersion = '~0.5.0';
export const swcNodeVersion = '~1.4.2';
export const tsLibVersion = '^2.3.0';
export const typesNodeVersion = '18.7.1';
export const verdaccioVersion = '^5.0.4';

// Typescript
export const typescriptVersion = '~5.1.3';
/**
 * The minimum version is currently determined from the lowest version
 * that's supported by the lowest Angular supported version, e.g.
 * `npm view @angular/compiler-cli@14.0.0 peerDependencies.typescript`
 */
export const supportedTypescriptVersions = '>=4.6.2';
