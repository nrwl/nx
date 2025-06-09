import * as latestVersions from './versions';

type SupportedVersions = 'angularV18' | 'angularV19';

type LatestPackageVersionNames = Exclude<
  keyof typeof latestVersions,
  'nxVersion'
>;
type CompatPackageVersionNames = LatestPackageVersionNames;

export type PackageVersionNames =
  | LatestPackageVersionNames
  | CompatPackageVersionNames;

export type VersionMap = {
  angularV18: Record<CompatPackageVersionNames, string>;
  angularV19: Record<CompatPackageVersionNames, string>;
};

export type PackageLatestVersions = Record<LatestPackageVersionNames, string>;
export type PackageCompatVersions = VersionMap[SupportedVersions];

export const backwardCompatibleVersions: VersionMap = {
  angularV18: {
    angularVersion: '~18.2.0',
    angularDevkitVersion: '~18.2.0',
    ngPackagrVersion: '~18.2.0',
    angularRspackVersion: '~20.6.1',
    ngrxVersion: '~18.0.2',
    rxjsVersion: '~7.8.0',
    zoneJsVersion: '~0.14.3',
    angularJsVersion: '1.7.9',
    tsLibVersion: '^2.3.0',
    corsVersion: '~2.8.5',
    typesCorsVersion: '~2.8.5',
    expressVersion: '^4.21.2',
    typesExpressVersion: '^4.17.21',
    browserSyncVersion: '^3.0.0',
    moduleFederationNodeVersion: '~2.5.0',
    moduleFederationEnhancedVersion: '0.6.9',
    angularEslintVersion: '^18.3.0',
    typescriptEslintVersion: '^7.16.0',
    tailwindVersion: '^3.0.2',
    postcssVersion: '^8.4.5',
    postcssUrlVersion: '~10.1.3',
    autoprefixerVersion: '^10.4.0',
    tsNodeVersion: '10.9.1',
    jestPresetAngularVersion: '~14.1.0',
    typesNodeVersion: '18.16.9',
    jasmineMarblesVersion: '^0.9.2',
    jsoncEslintParserVersion: '^2.1.0',
    webpackMergeVersion: '^5.8.0',
  },
  angularV19: {
    angularVersion: '~19.2.0',
    angularDevkitVersion: '~19.2.0',
    ngPackagrVersion: '~19.2.0',
    angularRspackVersion: '~20.6.1',
    ngrxVersion: '~19.1.0',
    rxjsVersion: '~7.8.0',
    zoneJsVersion: '~0.15.0',
    angularJsVersion: '1.7.9',
    tsLibVersion: '^2.3.0',
    corsVersion: '~2.8.5',
    typesCorsVersion: '~2.8.5',
    expressVersion: '^4.21.2',
    typesExpressVersion: '^4.17.21',
    browserSyncVersion: '^3.0.0',
    moduleFederationNodeVersion: '^2.6.26',
    moduleFederationEnhancedVersion: '^0.9.0',
    angularEslintVersion: '^19.2.0',
    typescriptEslintVersion: '^7.16.0',
    tailwindVersion: '^3.0.2',
    postcssVersion: '^8.4.5',
    postcssUrlVersion: '~10.1.3',
    autoprefixerVersion: '^10.4.0',
    tsNodeVersion: '10.9.1',
    jestPresetAngularVersion: '~14.4.0',
    typesNodeVersion: '18.16.9',
    jasmineMarblesVersion: '^0.9.2',
    jsoncEslintParserVersion: '^2.1.0',
    webpackMergeVersion: '^5.8.0',
  },
};
