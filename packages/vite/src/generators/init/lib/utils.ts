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
  viteVersion,
} from '../../../utils/versions.js';
import { InitGeneratorSchema } from '../schema.js';
import { getVitestDependenciesVersionsToInstall } from '../../../utils/version-utils.js';

export async function checkDependenciesInstalled(
  host: Tree,
  schema: InitGeneratorSchema
) {
  const { vitest } = await getVitestDependenciesVersionsToInstall(host);
  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nx/vite': nxVersion,
      '@nx/web': nxVersion,
      vite: schema.useViteV5
        ? viteV5Version
        : schema.useViteV6
        ? viteV6Version
        : viteVersion,
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
