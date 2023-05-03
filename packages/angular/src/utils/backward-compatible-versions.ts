import * as latestVersions from './versions';

type SupportedVersions = 'angularV14' | 'angularV15';
export type PackageVersionNames = Exclude<
  keyof typeof latestVersions,
  'nxVersion'
>;
export type PackageVersions = Record<PackageVersionNames, string>;

export const backwardCompatibleVersions: Record<
  SupportedVersions,
  PackageVersions
> = {
  angularV14: {
    angularVersion: '~14.2.0',
    angularDevkitVersion: '~14.2.0',
    ngPackagrVersion: '~14.2.0',
    ngrxVersion: '~14.0.0',
    rxjsVersion: '~7.8.0',
    zoneJsVersion: '~0.11.4',
    angularJsVersion: '1.7.9',
    tsLibVersion: '^2.3.0',
    ngUniversalVersion: '~14.2.0',
    corsVersion: '~2.8.5',
    typesCorsVersion: '~2.8.5',
    expressVersion: '~4.18.2',
    typesExpressVersion: '4.17.14',
    moduleFederationNodeVersion: '^0.10.1',
    angularEslintVersion: '~14.0.4',
    tailwindVersion: '^3.0.2',
    postcssVersion: '^8.4.5',
    postcssImportVersion: '~14.1.0',
    postcssPresetEnvVersion: '~7.5.0',
    postcssUrlVersion: '~10.1.3',
    autoprefixerVersion: '^10.4.0',
    tsNodeVersion: '10.9.1',
    jestPresetAngularVersion: '~12.2.3',
    typesNodeVersion: '16.11.7',
    jasmineMarblesVersion: '^0.9.2',
  },
  angularV15: {
    angularVersion: '~15.2.0',
    angularDevkitVersion: '~15.2.0',
    ngPackagrVersion: '~15.2.2',
    ngrxVersion: '~15.3.0',
    rxjsVersion: '~7.8.0',
    zoneJsVersion: '~0.12.0',
    angularJsVersion: '1.7.9',
    tsLibVersion: '^2.3.0',
    ngUniversalVersion: '~15.1.0',
    corsVersion: '~2.8.5',
    typesCorsVersion: '~2.8.5',
    expressVersion: '~4.18.2',
    typesExpressVersion: '4.17.14',
    moduleFederationNodeVersion: '~0.10.1',
    angularEslintVersion: '~15.0.0',
    tailwindVersion: '^3.0.2',
    postcssVersion: '^8.4.5',
    postcssImportVersion: '~14.1.0',
    postcssPresetEnvVersion: '~7.5.0',
    postcssUrlVersion: '~10.1.3',
    autoprefixerVersion: '^10.4.0',
    tsNodeVersion: '10.9.1',
    jestPresetAngularVersion: '~13.0.0',
    typesNodeVersion: '16.11.7',
    jasmineMarblesVersion: '^0.9.2',
  },
};
