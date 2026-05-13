import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
  installPackagesTask,
  output,
  Tree,
  updateJson,
} from '@nx/devkit';
import { esbuildVersion } from '@nx/js/internal';
import { intersects } from 'semver';
import {
  jitiVersion,
  nxVersion,
  viteV5Version,
  viteV6Version,
  viteV7Version,
  viteVersion,
} from '../../../utils/versions';
import { InitGeneratorSchema } from '../schema';
import { getInstalledViteMajorVersion } from '../../../utils/version-utils';

function hasIncompatibleInstalledEsbuild(host: Tree): boolean {
  const installedEsbuildVersion = getDependencyVersionFromPackageJson(
    host,
    'esbuild'
  );

  if (!installedEsbuildVersion) {
    return false;
  }

  try {
    return !intersects(installedEsbuildVersion, esbuildVersion, {
      includePrerelease: true,
    });
  } catch {
    return true;
  }
}

export async function checkDependenciesInstalled(
  host: Tree,
  schema: InitGeneratorSchema
) {
  // Determine which vite version to install:
  // 1. Explicit flags take priority (useViteV5/V6/V7)
  // 2. If vite is already installed, keep the matching major version
  // 3. If esbuild is already installed but incompatible with Vite 8, use Vite 7
  // 4. Otherwise, use the latest default (^8.0.0)
  const installedMajor = getInstalledViteMajorVersion(host);
  const installedEsbuildVersion = getDependencyVersionFromPackageJson(
    host,
    'esbuild'
  );
  const useViteV7ForEsbuildCompatibility =
    installedMajor == null && hasIncompatibleInstalledEsbuild(host);

  if (useViteV7ForEsbuildCompatibility) {
    output.warn({
      title: 'Installed esbuild is incompatible with Vite 8. Using Vite 7.',
      bodyLines: [
        `Found esbuild version "${installedEsbuildVersion}" in the workspace root package.json.`,
        `Update esbuild to a range compatible with ${esbuildVersion} if you want newly generated Vite projects to use Vite 8 by default.`,
      ],
    });
  }

  const viteVersionToInstall = schema.useViteV5
    ? viteV5Version
    : schema.useViteV6
      ? viteV6Version
      : schema.useViteV7 ||
          installedMajor === 7 ||
          useViteV7ForEsbuildCompatibility
        ? viteV7Version
        : installedMajor === 6
          ? viteV6Version
          : installedMajor === 5
            ? viteV5Version
            : viteVersion;

  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nx/vite': nxVersion,
      '@nx/web': nxVersion,
      vite: viteVersionToInstall,
      jiti: jitiVersion,
    },
    undefined,
    schema.keepExistingVersions
  );
}

export function moveToDevDependencies(tree: Tree) {
  let wasUpdated = false;
  updateJson(tree, 'package.json', (packageJson) => {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    if (packageJson.dependencies['@nx/vite']) {
      packageJson.devDependencies['@nx/vite'] =
        packageJson.dependencies['@nx/vite'];
      delete packageJson.dependencies['@nx/vite'];
      wasUpdated = true;
    }
    return packageJson;
  });

  return wasUpdated ? () => installPackagesTask(tree) : () => {};
}
