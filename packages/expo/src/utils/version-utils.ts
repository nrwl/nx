import {
  createProjectGraphAsync,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import type { Tree } from 'nx/src/generators/tree';
import { clean, coerce, major } from 'semver';
import {
  // v55 versions
  expoV55Version,
  expoV55SplashScreenVersion,
  expoV55StatusBarVersion,
  expoV55SystemUiVersion,
  expoV55CliVersion,
  babelPresetExpoV55Version,
  expoV55MetroConfigVersion,
  expoV55MetroRuntimeVersion,
  jestExpoV55Version,
  reactV55Version,
  reactDomV55Version,
  typesReactV55Version,
  reactNativeV55Version,
  metroV55Version,
  reactNativeWebV55Version,
  reactTestRendererV55Version,
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
  reactTestRendererV54Version,
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
  reactTestRendererV53Version,
  // Shared versions
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  testingLibraryReactNativeVersion,
  babelRuntimeVersion,
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
  reactTestRenderer: string;
  babelRuntime: string;
};

// Version-independent deps shared by every Expo lane.
const sharedVersions = {
  reactNativeSvgTransformer: reactNativeSvgTransformerVersion,
  reactNativeSvg: reactNativeSvgVersion,
  testingLibraryReactNative: testingLibraryReactNativeVersion,
  babelRuntime: babelRuntimeVersion,
};

// Per-major Expo install lanes. 55 is the latest/default; 53 and 54 are kept
// for existing workspaces. Anything outside this window routes to 55 — the
// below-floor throw is assertSupportedExpoVersion's job, not the router's.
const expoVersionsByMajor: Record<53 | 54 | 55, ExpoDependenciesVersions> = {
  53: {
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
    reactTestRenderer: reactTestRendererV53Version,
    ...sharedVersions,
  },
  54: {
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
    reactTestRenderer: reactTestRendererV54Version,
    ...sharedVersions,
  },
  55: {
    expo: expoV55Version,
    expoSplashScreen: expoV55SplashScreenVersion,
    expoStatusBar: expoV55StatusBarVersion,
    expoSystemUi: expoV55SystemUiVersion,
    expoCli: expoV55CliVersion,
    babelPresetExpo: babelPresetExpoV55Version,
    expoMetroConfig: expoV55MetroConfigVersion,
    expoMetroRuntime: expoV55MetroRuntimeVersion,
    jestExpo: jestExpoV55Version,
    react: reactV55Version,
    reactDom: reactDomV55Version,
    typesReact: typesReactV55Version,
    reactNative: reactNativeV55Version,
    metro: metroV55Version,
    reactNativeWeb: reactNativeWebV55Version,
    reactTestRenderer: reactTestRendererV55Version,
    ...sharedVersions,
  },
};

/**
 * Get the appropriate dependency versions based on the installed Expo version.
 * Returns v53 or v54 versions when those are detected, otherwise v55 (latest).
 */
export async function getExpoDependenciesVersionsToInstall(
  tree: Tree
): Promise<ExpoDependenciesVersions> {
  const installedMajor = await getInstalledExpoMajor(tree);
  if (installedMajor === 53 || installedMajor === 54) {
    return expoVersionsByMajor[installedMajor];
  }
  return expoVersionsByMajor[55];
}

/**
 * Resolve the installed Expo major version. Prefers the resolved version from
 * the project graph, falling back to the declared package.json version.
 * Returns null when Expo isn't installed.
 */
async function getInstalledExpoMajor(tree: Tree): Promise<number | null> {
  const installedExpoVersion =
    (await getInstalledExpoVersionFromGraph()) ?? getInstalledExpoVersion(tree);
  return installedExpoVersion ? major(installedExpoVersion) : null;
}

/**
 * Check if the workspace is using Expo v53 — the only SDK that still needs the
 * legacy Jest resolver. SDK 54+ use the winter-runtime mock instead.
 */
export async function isExpoV53(tree: Tree): Promise<boolean> {
  return (await getInstalledExpoMajor(tree)) === 53;
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
