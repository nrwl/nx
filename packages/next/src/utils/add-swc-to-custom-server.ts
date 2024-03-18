import {
  Tree,
  addDependenciesToPackageJson,
  installPackagesTask,
  joinPathFragments,
  readJson,
  updateJson,
} from '@nx/devkit';
import { swcCliVersion, swcCoreVersion, swcNodeVersion } from './versions';
import { addSwcConfig } from '@nx/js/src/utils/swc/add-swc-config';

export function configureForSwc(tree: Tree, projectRoot: string) {
  const swcConfigPath = joinPathFragments(projectRoot, '.swcrc');
  const rootPackageJson = readJson(tree, 'package.json');

  const hasSwcDepedency =
    rootPackageJson.dependencies?.['@swc/core'] ||
    rootPackageJson.devDependencies?.['@swc/core'];

  const hasSwcCliDependency =
    rootPackageJson.dependencies?.['@swc/cli'] ||
    rootPackageJson.devDependencies?.['@swc/cli'];

  if (!tree.exists(swcConfigPath)) {
    addSwcConfig(tree, projectRoot);
  }

  if (tree.exists(swcConfigPath)) {
    updateJson(tree, swcConfigPath, (json) => {
      return {
        ...json,
        exclude: [...json.exclude, '.*.d.ts$'],
      };
    });
  }

  if (!hasSwcDepedency || !hasSwcCliDependency) {
    addSwcDependencies(tree);
    return () => installPackagesTask(tree);
  }
}

function addSwcDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@swc-node/register': swcNodeVersion,
      '@swc/cli': swcCliVersion,
      '@swc/core': swcCoreVersion,
    }
  );
}
