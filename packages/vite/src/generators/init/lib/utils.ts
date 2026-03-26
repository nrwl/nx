import {
  addDependenciesToPackageJson,
  installPackagesTask,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import {
  jitiVersion,
  nxVersion,
  viteV5Version,
  viteV6Version,
  viteV7Version,
  viteVersion,
} from '../../../utils/versions';
import { InitGeneratorSchema } from '../schema';
import {
  getInstalledViteMajorVersion,
  getVitestDependenciesVersionsToInstall,
} from '../../../utils/version-utils';

export async function checkDependenciesInstalled(
  host: Tree,
  schema: InitGeneratorSchema
) {
  const { vitest } = await getVitestDependenciesVersionsToInstall(host);

  // Determine which vite version to install:
  // 1. Explicit flags take priority (useViteV5/V6/V7)
  // 2. If vite is already installed, keep the matching major version
  // 3. Otherwise, use the latest default (^8.0.0)
  const installedMajor = getInstalledViteMajorVersion(host);
  const viteVersionToInstall = schema.useViteV5
    ? viteV5Version
    : schema.useViteV6
      ? viteV6Version
      : schema.useViteV7 || installedMajor === 7
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
      vitest: vitest,
      '@vitest/ui': vitest,
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
