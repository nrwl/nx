import {
  createProjectGraphAsync,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import type { Tree } from 'nx/src/generators/tree';
import { clean, coerce, major } from 'semver';
import {
  // v54 versions
  expoV54Version,
  expoV54SplashScreenVersion,
  expoV54StatusBarVersion,
  expoV54SystemUiVersion,
  expoV54CliVersion,
  babelPresetExpoV54Version,
  expoV54MetroConfigVersion,
  expoV54MetroRuntimeVersion,
  jestExpoV54Version,
  reactV54Version,
  reactDomV54Version,
  typesReactV54Version,
  reactNativeV54Version,
  metroV54Version,
  reactNativeWebV54Version,
  // v53 versions
  expoV53Version,
  expoV53SplashScreenVersion,
  expoV53StatusBarVersion,
  expoV53SystemUiVersion,
  expoV53CliVersion,
  babelPresetExpoV53Version,
  expoV53MetroConfigVersion,
  expoV53MetroRuntimeVersion,
  jestExpoV53Version,
  reactV53Version,
  reactDomV53Version,
  typesReactV53Version,
  reactNativeV53Version,
  metroV53Version,
  reactNativeWebV53Version,
  // Shared versions
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  testingLibraryReactNativeVersion,
  babelRuntimeVersion,
  // Default versions
  expoVersion,
} from './versions';

export type ExpoDependenciesVersions = {
  expo: string;
  expoSplashScreen: string;
  expoStatusBar: string;
  expoSystemUi: string;
  expoCli: string;
  babelPresetExpo: string;
  expoMetroConfig: string;
  expoMetroRuntime: string;
  jestExpo: string;
  react: string;
  reactDom: string;
  typesReact: string;
  reactNative: string;
  metro: string;
  reactNativeWeb: string;
  // Shared (version-independent)
  reactNativeSvgTransformer: string;
  reactNativeSvg: string;
  testingLibraryReactNative: string;
  babelRuntime: string;
};

/**
 * Get the appropriate dependency versions based on the installed Expo version.
 * Returns v53 versions if v53 is detected, otherwise returns v54 (latest).
 */
export async function getExpoDependenciesVersionsToInstall(
  tree: Tree
): Promise<ExpoDependenciesVersions> {
  const sharedVersions = {
    reactNativeSvgTransformer: reactNativeSvgTransformerVersion,
    reactNativeSvg: reactNativeSvgVersion,
    testingLibraryReactNative: testingLibraryReactNativeVersion,
    babelRuntime: babelRuntimeVersion,
  };

  if (await isExpoV53(tree)) {
    return {
      expo: expoV53Version,
      expoSplashScreen: expoV53SplashScreenVersion,
      expoStatusBar: expoV53StatusBarVersion,
      expoSystemUi: expoV53SystemUiVersion,
      expoCli: expoV53CliVersion,
      babelPresetExpo: babelPresetExpoV53Version,
      expoMetroConfig: expoV53MetroConfigVersion,
      expoMetroRuntime: expoV53MetroRuntimeVersion,
      jestExpo: jestExpoV53Version,
      react: reactV53Version,
      reactDom: reactDomV53Version,
      typesReact: typesReactV53Version,
      reactNative: reactNativeV53Version,
      metro: metroV53Version,
      reactNativeWeb: reactNativeWebV53Version,
      ...sharedVersions,
    };
  }

  // Default to v54 (latest)
  return {
    expo: expoV54Version,
    expoSplashScreen: expoV54SplashScreenVersion,
    expoStatusBar: expoV54StatusBarVersion,
    expoSystemUi: expoV54SystemUiVersion,
    expoCli: expoV54CliVersion,
    babelPresetExpo: babelPresetExpoV54Version,
    expoMetroConfig: expoV54MetroConfigVersion,
    expoMetroRuntime: expoV54MetroRuntimeVersion,
    jestExpo: jestExpoV54Version,
    react: reactV54Version,
    reactDom: reactDomV54Version,
    typesReact: typesReactV54Version,
    reactNative: reactNativeV54Version,
    metro: metroV54Version,
    reactNativeWeb: reactNativeWebV54Version,
    ...sharedVersions,
  };
}

/**
 * Check if the workspace is using Expo v53.
 */
export async function isExpoV53(tree: Tree): Promise<boolean> {
  let installedExpoVersion = await getInstalledExpoVersionFromGraph();
  if (!installedExpoVersion) {
    installedExpoVersion = getInstalledExpoVersion(tree);
  }
  if (!installedExpoVersion) {
    return false; // No Expo installed, default to latest
  }
  return major(installedExpoVersion) === 53;
}

/**
 * Check if the workspace is using Expo v54.
 */
export async function isExpoV54(tree: Tree): Promise<boolean> {
  let installedExpoVersion = await getInstalledExpoVersionFromGraph();
  if (!installedExpoVersion) {
    installedExpoVersion = getInstalledExpoVersion(tree);
  }
  if (!installedExpoVersion) {
    return true; // No Expo installed, default to latest (v54)
  }
  return major(installedExpoVersion) === 54;
}

/**
 * Get the installed Expo version from package.json.
 */
export function getInstalledExpoVersion(tree: Tree): string | null {
  const installedExpoVersion = getDependencyVersionFromPackageJson(
    tree,
    'expo'
  );

  if (
    !installedExpoVersion ||
    installedExpoVersion === 'latest' ||
    installedExpoVersion === 'beta'
  ) {
    return null;
  }

  return (
    clean(installedExpoVersion) ?? coerce(installedExpoVersion)?.version ?? null
  );
}

/**
 * Get the installed Expo major version.
 */
export function getInstalledExpoMajorVersion(tree: Tree): 53 | 54 | undefined {
  const installedExpoVersion = getInstalledExpoVersion(tree);
  if (!installedExpoVersion) {
    return undefined;
  }

  const installedMajor = major(installedExpoVersion);
  if (installedMajor !== 53 && installedMajor !== 54) {
    return undefined;
  }
  return installedMajor as 53 | 54;
}

/**
 * Get the installed Expo version from the project graph.
 */
export async function getInstalledExpoVersionFromGraph(): Promise<
  string | undefined
> {
  try {
    const graph = await createProjectGraphAsync();
    const expoDep = graph.externalNodes?.['npm:expo'];
    if (!expoDep) {
      return undefined;
    }
    return clean(expoDep.data.version) ?? coerce(expoDep.data.version)?.version;
  } catch {
    return undefined;
  }
}
