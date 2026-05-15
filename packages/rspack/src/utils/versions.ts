import { join } from 'path';
export const nxVersion = require(join('@nx/rspack', 'package.json')).version;

export const minSupportedRspackVersion = '1.0.0';

export const lessLoaderVersion = '~11.1.3';
export const sassLoaderVersion = '^16.0.7';
export const sassEmbeddedVersion = '^1.97.2';
export const reactRefreshVersion = '~0.14.0';

// Supported `@rspack/core` majors. v2 is the latest; v1 stays in the
// window for backward compatibility per the multi-version policy.
export const supportedRspackMajorVersions = [2, 1] as const;
export type SupportedRspackMajorVersion =
  (typeof supportedRspackMajorVersions)[number];

type RspackVersionMap = {
  rspackCoreVersion: string;
  rspackDevServerVersion: string;
  rspackPluginReactRefreshVersion: string;
};

export const latestRspackVersions: RspackVersionMap = {
  rspackCoreVersion: '2.0.3',
  rspackDevServerVersion: '^2.0.1',
  rspackPluginReactRefreshVersion: '^2.0.0',
};

export const backwardCompatibleRspackVersions: Record<
  SupportedRspackMajorVersion,
  RspackVersionMap
> = {
  2: latestRspackVersions,
  1: {
    rspackCoreVersion: '1.6.8',
    rspackDevServerVersion: '^1.1.4',
    rspackPluginReactRefreshVersion: '^1.0.0',
  },
};

/**
 * Kept for backward compatibility with code paths that don't yet branch on
 * the detected installed major. Points at the latest supported major.
 */
export const rspackCoreVersion = latestRspackVersions.rspackCoreVersion;
export const rspackDevServerVersion =
  latestRspackVersions.rspackDevServerVersion;
export const rspackPluginReactRefreshVersion =
  latestRspackVersions.rspackPluginReactRefreshVersion;
