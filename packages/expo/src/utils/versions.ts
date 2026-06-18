import { join } from 'path';
import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';

export const nxVersion = require(join('@nx/expo', 'package.json')).version;

// Lowest supported Expo SDK. Below this, generators throw via
// assertSupportedExpoVersion. Expo Go only supports the latest SDK, but the
// plugin keeps install lanes for the recent SDKs it has constants for (53–55).
export const minSupportedExpoVersion = '53.0.0';

export function assertSupportedExpoVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'expo', minSupportedExpoVersion);
}

// Expo v55 versions (default for new projects) — RN 0.83, React 19.2
export const expoV55Version = '~55.0.26';
export const expoV55SplashScreenVersion = '~55.0.21';
export const expoV55StatusBarVersion = '~55.0.6';
export const expoV55SystemUiVersion = '~55.0.18';
export const expoV55CliVersion = '~55.0.11';
export const babelPresetExpoV55Version = '~55.0.7';
export const expoV55MetroConfigVersion = '~55.0.8';
export const expoV55MetroRuntimeVersion = '~55.0.11';
export const jestExpoV55Version = '~55.0.18';
export const reactV55Version = '^19.2.0';
export const reactDomV55Version = '^19.2.0';
export const typesReactV55Version = '^19.2.0';
export const reactNativeV55Version = '0.83.6';
export const metroV55Version = '~0.83.0';
export const reactNativeWebV55Version = '~0.21.0';
export const reactTestRendererV55Version = '^19.2.0';

// Expo v54 versions (for existing workspaces)
export const expoV54Version = '~54.0.0';
export const expoV54SplashScreenVersion = '~31.0.11';
export const expoV54StatusBarVersion = '~3.0.8';
export const expoV54SystemUiVersion = '~6.0.8';
export const expoV54CliVersion = '~54.0.16';
export const babelPresetExpoV54Version = '~54.0.7';
export const expoV54MetroConfigVersion = '~54.0.9';
export const expoV54MetroRuntimeVersion = '~6.1.2';
export const jestExpoV54Version = '~54.0.13';
export const reactV54Version = '^19.1.0';
export const reactDomV54Version = '^19.1.0';
export const typesReactV54Version = '^19.1.0';
export const reactNativeV54Version = '0.81.5';
export const metroV54Version = '~0.83.0';
export const reactNativeWebV54Version = '~0.21.0';
export const reactTestRendererV54Version = '^19.1.0';

// Expo v53 versions (for existing workspaces)
export const expoV53Version = '~53.0.10';
export const expoV53SplashScreenVersion = '~0.30.9';
export const expoV53StatusBarVersion = '~2.2.3';
export const expoV53SystemUiVersion = '~5.0.8';
export const expoV53CliVersion = '~0.24.14'; // @expo/cli
export const babelPresetExpoV53Version = '~13.2.0';
export const expoV53MetroConfigVersion = '~0.20.14';
export const expoV53MetroRuntimeVersion = '~5.0.4';
export const jestExpoV53Version = '~53.0.7';
export const reactV53Version = '^19.0.0';
export const reactDomV53Version = '^19.0.0';
export const typesReactV53Version = '~19.0.10';
export const reactNativeV53Version = '0.79.3';
export const metroV53Version = '~0.82.4';
export const reactNativeWebV53Version = '~0.20.0';
export const reactTestRendererV53Version = '^19.0.0';

// Default exports point to v55 (latest)
export const expoVersion = expoV55Version;
export const expoSplashScreenVersion = expoV55SplashScreenVersion;
export const expoStatusBarVersion = expoV55StatusBarVersion;
export const expoSystemUiVersion = expoV55SystemUiVersion;
export const expoCliVersion = expoV55CliVersion;
export const babelPresetExpoVersion = babelPresetExpoV55Version;
export const expoMetroConfigVersion = expoV55MetroConfigVersion;
export const expoMetroRuntimeVersion = expoV55MetroRuntimeVersion;
export const jestExpoVersion = jestExpoV55Version;
export const reactVersion = reactV55Version;
export const reactDomVersion = reactDomV55Version;
export const typesReactVersion = typesReactV55Version;
export const reactNativeVersion = reactNativeV55Version;
export const metroVersion = metroV55Version;
export const reactNativeWebVersion = reactNativeWebV55Version;

// Shared versions (version-independent)
export const reactNativeSvgTransformerVersion = '~1.5.1';
export const reactNativeSvgVersion = '15.12.1';
export const testingLibraryReactNativeVersion = '~13.2.0';
export const babelRuntimeVersion = '~7.27.6';
