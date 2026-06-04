import { join } from 'path';
import { type Tree } from '@nx/devkit';
import {
  assertSupportedPackageVersion,
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { minor } from 'semver';

export const nxVersion = require(
  join('@nx/react-native', 'package.json')
).version;

// React Native's tiered support policy lists 0.85 and 0.84 as Active, 0.83 as
// End-of-Cycle, and 0.82 and below as Unsupported. The plugin supports the
// 0.83–0.85 window; below 0.83 generators throw via assertSupportedReactNativeVersion.
export const minSupportedReactNativeVersion = '0.83.0';

export function assertSupportedReactNativeVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    'react-native',
    minSupportedReactNativeVersion
  );
}

// Fresh-install constants point at the latest supported minor (0.85).
export const reactNativeVersion = '~0.85.3';
export const reactNativeBabelPresetVersion = '~0.85.3';
export const reactNativeMetroConfigVersion = '~0.85.3';
export const metroVersion = '~0.84.0';
export const reactNativeCommunityCliVersion = '~20.1.0';
export const reactNativeCommunityCliPlatformAndroidVersion = '~20.1.0';
export const reactNativeCommunityCliPlatformIosVersion = '~20.1.0';

// Stable across the supported RN minors (0.83–0.85 all ship React 19.2).
export const typesNodeVersion = '^22.0.0';
export const reactNativeWebVersion = '~0.21.0';
export const reactVersion = '^19.2.0';
export const reactDomVersion = '^19.2.0';
export const typesReactVersion = '^19.2.0';
export const typesReactDomVersion = '^19.2.0';
export const testingLibraryReactNativeVersion = '~13.2.0';
export const reactTestRendererVersion = '^19.2.0';
export const reactNativeSvgTransformerVersion = '~1.5.1';
export const reactNativeSvgVersion = '~15.15.0';
export const reactNativeSvgWebVersion = '~1.0.9';
export const babelRuntimeVersion = '~7.27.6';

export type ReactNativeVersions = {
  reactNativeVersion: string;
  reactNativeBabelPresetVersion: string;
  reactNativeMetroConfigVersion: string;
  metroVersion: string;
  reactNativeCommunityCliVersion: string;
  reactNativeCommunityCliPlatformAndroidVersion: string;
  reactNativeCommunityCliPlatformIosVersion: string;
};

// latestVersions reuses the top-level exports so `import { reactNativeVersion }`
// stays valid for the fresh-install path while versions(tree).reactNativeVersion
// is the route-aware value.
const latestVersions: ReactNativeVersions = {
  reactNativeVersion,
  reactNativeBabelPresetVersion,
  reactNativeMetroConfigVersion,
  metroVersion,
  reactNativeCommunityCliVersion,
  reactNativeCommunityCliPlatformAndroidVersion,
  reactNativeCommunityCliPlatformIosVersion,
};

// Keyed by React Native MINOR — RN is on the 0.x line, so the major is always 0.
type CompatMinors = 83 | 84;
const versionMap: Record<CompatMinors, ReactNativeVersions> = {
  83: {
    reactNativeVersion: '~0.83.9',
    reactNativeBabelPresetVersion: '~0.83.9',
    reactNativeMetroConfigVersion: '~0.83.9',
    metroVersion: '~0.83.0',
    reactNativeCommunityCliVersion: '~20.0.0',
    reactNativeCommunityCliPlatformAndroidVersion: '~20.0.0',
    reactNativeCommunityCliPlatformIosVersion: '~20.0.0',
  },
  84: {
    reactNativeVersion: '~0.84.1',
    reactNativeBabelPresetVersion: '~0.84.1',
    reactNativeMetroConfigVersion: '~0.84.1',
    metroVersion: '~0.83.0',
    reactNativeCommunityCliVersion: '~20.1.0',
    reactNativeCommunityCliPlatformAndroidVersion: '~20.1.0',
    reactNativeCommunityCliPlatformIosVersion: '~20.1.0',
  },
};

export function getInstalledReactNativeVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('react-native');
  }
  return getDeclaredPackageVersion(tree, 'react-native');
}

// Returns the install constants for the detected RN minor. Above the highest
// known minor (or when RN isn't installed) falls through to latest — no throw.
export function versions(tree?: Tree): ReactNativeVersions {
  const installedReactNativeVersion = getInstalledReactNativeVersion(tree);
  if (!installedReactNativeVersion) {
    return latestVersions;
  }
  return (
    versionMap[minor(installedReactNativeVersion) as CompatMinors] ??
    latestVersions
  );
}
