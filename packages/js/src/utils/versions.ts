export const nxVersion = require('../../package.json').version;

export const esbuildVersion = '^0.19.2';
export const prettierVersion = '~3.6.2';
export const swcCliVersion = '~0.7.2';
export const swcCoreVersion = '~1.15.5';
export const swcHelpersVersion = '~0.5.18';
export const swcNodeVersion = '~1.11.1';
export const tsLibVersion = '^2.3.0';
export const typesNodeVersion = '20.19.9';
export const verdaccioVersion = '^6.0.5';

// Typescript
export const typescriptVersion = '~5.9.2';
/**
 * The minimum version is currently determined from the lowest version
 * that's supported by the lowest Angular supported version, e.g.
 * `npm view @angular/compiler-cli@18.0.0 peerDependencies.typescript`
 */
export const supportedTypescriptVersions = '>=5.4.0';
