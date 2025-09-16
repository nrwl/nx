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
} from '../../../utils/versions';
import { InitGeneratorSchema } from '../schema';
import { getVitestDependenciesVersionsToInstall } from '../../../utils/version-utils';

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

export function createVitestConfig(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  updateNxJson(tree, nxJson);
}
