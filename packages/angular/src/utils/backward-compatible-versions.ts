import * as latestVersions from './versions';

export const supportedVersions = [22, 21, 20] as const;
export type SupportedVersion = (typeof supportedVersions)[number];

export type PackageVersionNames = Exclude<
  keyof typeof latestVersions,
  'nxVersion'
>;
export type VersionMap = {
  22: Record<PackageVersionNames, string>;
  21: Record<PackageVersionNames, string>;
  20: Record<PackageVersionNames, string>;
};

export type PackageCompatVersions = VersionMap[SupportedVersion];

export const backwardCompatibleVersions: VersionMap = {
  22: { ...latestVersions },
  21: {
    angularVersion: '~21.2.0',
    angularDevkitVersion: '~21.2.0',
    ngPackagrVersion: '~21.2.0',
    ngrxVersion: '^21.0.0',
    rxjsVersion: '~7.8.0',
    zoneJsVersion: '~0.16.0',
    tsLibVersion: '^2.3.0',
    corsVersion: '~2.8.5',
    typesCorsVersion: '~2.8.5',
    expressVersion: '^4.21.2',
    typesExpressVersion: '^4.17.21',
    browserSyncVersion: '^3.0.0',
    moduleFederationNodeVersion: '^2.7.21',
    moduleFederationEnhancedVersion: '^2.1.0',
    angularEslintVersion: '^21.2.0',
    typescriptEslintVersion: '^7.16.0',
    postcssVersion: '^8.4.5',
    postcssUrlVersion: '~10.1.3',
    autoprefixerVersion: '^10.4.0',
    tsNodeVersion: '10.9.1',
    lessVersion: '^4.3.0',
    jestPresetAngularVersion: '~16.0.0',
    typesNodeVersion: '^22.0.0',
    jasmineMarblesVersion: '^0.9.2',
    jsoncEslintParserVersion: '^2.1.0',
    webpackMergeVersion: '^5.8.0',
    vitestVersion: '^4.0.8',
    jsdomVersion: '^27.1.0',
    oxcProjectRuntimeVersion: '^0.115.0',
  },
  20: {
    angularVersion: '~20.3.0',
    angularDevkitVersion: '~20.3.0',
    ngPackagrVersion: '~20.3.0',
    ngrxVersion: '^20.0.0',
    rxjsVersion: '~7.8.0',
    zoneJsVersion: '~0.15.0',
    tsLibVersion: '^2.3.0',
    corsVersion: '~2.8.5',
    typesCorsVersion: '~2.8.5',
    expressVersion: '^4.21.2',
    typesExpressVersion: '^4.17.21',
    browserSyncVersion: '^3.0.0',
    moduleFederationNodeVersion: '^2.7.21',
    moduleFederationEnhancedVersion: '^0.21.2',
    angularEslintVersion: '^20.3.0',
    typescriptEslintVersion: '^8.40.0',
    postcssVersion: '^8.4.5',
    postcssUrlVersion: '~10.1.3',
    autoprefixerVersion: '^10.4.0',
    tsNodeVersion: '10.9.1',
    lessVersion: '^4.3.0',
    jestPresetAngularVersion: '~14.6.1',
    typesNodeVersion: '^22.0.0',
    jasmineMarblesVersion: '^0.9.2',
    jsoncEslintParserVersion: '^2.1.0',
    webpackMergeVersion: '^5.8.0',
    vitestVersion: '^3.1.1',
    jsdomVersion: '~22.1.0',
    oxcProjectRuntimeVersion: '^0.115.0',
  },
};
