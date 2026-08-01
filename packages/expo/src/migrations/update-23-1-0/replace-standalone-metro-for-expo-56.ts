import {
  Tree,
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,
  joinPathFragments,
  readJson,
} from '@nx/devkit';
import { expoV56MetroVersion } from '../../utils/versions';
import { getExpoAppRoots } from './lib/expo-apps';

/**
 * Expo SDK 55+ provides Metro through `@expo/metro`. Installing the standalone
 * `metro-config`/`metro-resolver` packages alongside it pulls in a second,
 * incompatible Metro instance that breaks bundling. Replace them with
 * `@expo/metro` (a direct dependency is required so `withNxMetro` and the
 * generated `metro.config.js` can `require('@expo/metro/metro-config')` under
 * pnpm).
 */
export default function update(tree: Tree) {
  const appRoots = getExpoAppRoots(tree);
  if (appRoots.length === 0) {
    return;
  }

  // Root package.json holds the pinned versions in the integrated layout.
  swapMetro(tree, 'package.json', expoV56MetroVersion);

  // App package.jsons declare deps as `*` (resolved from the root).
  for (const projectRoot of appRoots) {
    swapMetro(tree, joinPathFragments(projectRoot, 'package.json'), '*');
  }
}

function swapMetro(
  tree: Tree,
  packageJsonPath: string,
  expoMetroVersion: string
) {
  if (!tree.exists(packageJsonPath)) {
    return;
  }

  const packageJson = readJson(tree, packageJsonPath);
  const hasStandaloneMetro =
    packageJson.dependencies?.['metro-config'] ||
    packageJson.dependencies?.['metro-resolver'] ||
    packageJson.devDependencies?.['metro-config'] ||
    packageJson.devDependencies?.['metro-resolver'];

  // Only touch workspaces/apps that still carry the standalone packages.
  if (!hasStandaloneMetro) {
    return;
  }

  removeDependenciesFromPackageJson(
    tree,
    ['metro-config', 'metro-resolver'],
    ['metro-config', 'metro-resolver'],
    packageJsonPath
  );

  const alreadyHasExpoMetro =
    packageJson.dependencies?.['@expo/metro'] ||
    packageJson.devDependencies?.['@expo/metro'];
  if (!alreadyHasExpoMetro) {
    addDependenciesToPackageJson(
      tree,
      { '@expo/metro': expoMetroVersion },
      {},
      packageJsonPath
    );
  }
}
