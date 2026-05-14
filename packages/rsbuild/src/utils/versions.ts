export const nxVersion = require('../../package.json').version;

export const minSupportedRsbuildVersion = '1.0.0';

// Supported `@rsbuild/core` majors. Currently v1 only — v2 ships as pure
// ESM, which @nx/rsbuild (CommonJS) cannot consume without a deeper
// refactor; tracked separately.
export const supportedRsbuildMajorVersions = [1] as const;
export type SupportedRsbuildMajorVersion =
  (typeof supportedRsbuildMajorVersions)[number];

type RsbuildVersionMap = {
  rsbuildVersion: string;
  rsbuildPluginReactVersion: string;
  rsbuildPluginVueVersion: string;
  rsbuildPluginSassVersion: string;
};

export const latestRsbuildVersions: RsbuildVersionMap = {
  rsbuildVersion: '1.1.10',
  rsbuildPluginReactVersion: '1.1.0',
  rsbuildPluginVueVersion: '1.0.5',
  rsbuildPluginSassVersion: '1.1.2',
};

export const backwardCompatibleRsbuildVersions: Record<
  SupportedRsbuildMajorVersion,
  RsbuildVersionMap
> = {
  1: latestRsbuildVersions,
};

/**
 * Kept for backward compatibility with code paths that don't yet branch on
 * the detected installed major. Points at the latest supported major.
 */
export const rsbuildVersion = latestRsbuildVersions.rsbuildVersion;
export const rsbuildPluginReactVersion =
  latestRsbuildVersions.rsbuildPluginReactVersion;
export const rsbuildPluginVueVersion =
  latestRsbuildVersions.rsbuildPluginVueVersion;
export const rsbuildPluginSassVersion =
  latestRsbuildVersions.rsbuildPluginSassVersion;
