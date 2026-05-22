import { join } from 'path';
export const nxVersion = require(join('@nx/rsbuild', 'package.json')).version;

export const minSupportedRsbuildVersion = '1.0.0';

// Supported `@rsbuild/core` majors. v2 is the latest; v1 stays in the
// window for backward compatibility per the multi-version policy.
export const supportedRsbuildMajorVersions = [2, 1] as const;
export type SupportedRsbuildMajorVersion =
  (typeof supportedRsbuildMajorVersions)[number];

type RsbuildVersionMap = {
  rsbuildVersion: string;
  rsbuildPluginReactVersion: string;
  rsbuildPluginVueVersion: string;
  rsbuildPluginSassVersion: string;
};

export const latestRsbuildVersions: RsbuildVersionMap = {
  rsbuildVersion: '2.0.7',
  rsbuildPluginReactVersion: '2.0.0',
  // plugin-vue and plugin-sass still publish 1.x but declare compatibility
  // with rsbuild ^1.0.0 || ^2.0.0-0, so the same range works on both
  // majors.
  rsbuildPluginVueVersion: '1.2.8',
  rsbuildPluginSassVersion: '1.5.2',
};

export const backwardCompatibleRsbuildVersions: Record<
  SupportedRsbuildMajorVersion,
  RsbuildVersionMap
> = {
  2: latestRsbuildVersions,
  1: {
    rsbuildVersion: '1.1.10',
    rsbuildPluginReactVersion: '1.1.0',
    rsbuildPluginVueVersion: '1.0.5',
    rsbuildPluginSassVersion: '1.1.2',
  },
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
