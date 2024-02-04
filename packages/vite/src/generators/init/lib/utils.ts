import {
  addDependenciesToPackageJson,
  installPackagesTask,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { nxVersion, vitestVersion, viteVersion } from '../../../utils/versions';
import { InitGeneratorSchema } from '../schema';

export function checkDependenciesInstalled(
  host: Tree,
  schema: InitGeneratorSchema
) {
  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nx/vite': nxVersion,
      '@nx/web': nxVersion,
      vite: viteVersion,
      vitest: vitestVersion,
      '@vitest/ui': vitestVersion,
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

export function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/vite/plugin'
        : plugin.plugin === '@nx/vite/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/vite/plugin',
    options: {
      buildTargetName: 'build',
      previewTargetName: 'preview',
      testTargetName: 'test',
      serveTargetName: 'serve',
      serveStaticTargetName: 'serve-static',
    },
  });
  updateNxJson(tree, nxJson);
}
