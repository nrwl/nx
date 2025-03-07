import {
  Tree,
  addDependenciesToPackageJson,
  installPackagesTask,
  joinPathFragments,
  readJson,
} from '@nx/devkit';
import {
  swcCliVersion,
  swcCoreVersion,
  swcNodeVersion,
  swcHelpersVersion,
} from '@nx/js/src/utils/versions';
import { addSwcConfig } from '@nx/js/src/utils/swc/add-swc-config';

export function configureForSwc(
  tree: Tree,
  projectRoot: string,
  swcConfigName = '.swcrc',
  additonalExludes: string[] = []
) {
  const swcConfigPath = joinPathFragments(projectRoot, swcConfigName);
  const rootPackageJson = readJson(tree, 'package.json');

  const hasSwcDepedency =
    rootPackageJson.dependencies?.['@swc/core'] ||
    rootPackageJson.devDependencies?.['@swc/core'];

  const hasSwcCliDependency =
    rootPackageJson.dependencies?.['@swc/cli'] ||
    rootPackageJson.devDependencies?.['@swc/cli'];

  if (!tree.exists(swcConfigPath)) {
    // We need to create a swc config file specific for custom server
    addSwcConfig(tree, projectRoot, 'commonjs', false, swcConfigName, [
      ...additonalExludes,
      '.*.d.ts$',
    ]);
  }

  if (!hasSwcDepedency || !hasSwcCliDependency) {
    addSwcDependencies(tree);
  }
  return () => installPackagesTask(tree);
}

function addSwcDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {
      '@swc/helpers': swcHelpersVersion,
    },
    {
      '@swc-node/register': swcNodeVersion,
      '@swc/cli': swcCliVersion,
      '@swc/core': swcCoreVersion,
    }
  );
}
