import {
  chain,
  Rule,
  noop,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree,
  readJsonInTree,
} from '../ast-utils';
import {
  renamePackageImports,
  PackageNameMapping,
} from './rename-package-imports';
import { formatFiles } from './format-files';

export interface PackageRenameMapping {
  [packageName: string]: string | [newPackageName: string, version: string];
}

interface NormalizedRenameDescriptors {
  packageName: string;
  newPackageName: string;
  version: string;
  isDevDep: boolean;
  inPackageJson: boolean;
}

const normalizeToDescriptors =
  (packageJson: any) =>
  ([packageName, newPackageNameConfig]): NormalizedRenameDescriptors => {
    const isDevDep =
      !!packageJson.devDependencies &&
      packageName in packageJson.devDependencies;
    const inPackageJson =
      (packageJson.dependencies && packageName in packageJson.dependencies) ||
      isDevDep;
    const newPackageName = Array.isArray(newPackageNameConfig)
      ? newPackageNameConfig[0]
      : newPackageNameConfig;
    const version =
      Array.isArray(newPackageNameConfig) && newPackageNameConfig[1]
        ? newPackageNameConfig[1]
        : isDevDep
        ? packageJson.devDependencies[packageName]
        : packageJson.dependencies[packageName];
    return {
      packageName,
      newPackageName,
      version,
      isDevDep,
      inPackageJson,
    };
  };

/**
 * Updates all the imports in the workspace, and adjust the package.json appropriately.
 *
 * @param packageNameMapping The packageNameMapping provided to the schematic
 */
export function renameNpmPackages(packageRenameMapping: PackageRenameMapping) {
  return (tree: Tree, context: SchematicContext): Rule => {
    const pkg = readJsonInTree(tree, 'package.json');

    const renameDescriptors = Object.entries(packageRenameMapping).map(
      normalizeToDescriptors(pkg)
    );

    // if you don't find the packageName in package.json abort
    if (
      renameDescriptors.filter(({ inPackageJson }) => inPackageJson).length ===
      0
    ) {
      return noop();
    }

    const packageNameMapping: PackageNameMapping = renameDescriptors.reduce(
      (mapping, { packageName, newPackageName }) => {
        mapping[packageName] = newPackageName;
        return mapping;
      },
      {}
    );

    const depAdditions = renameDescriptors.reduce(
      (mapping, { newPackageName, version, isDevDep }) => {
        if (!isDevDep) {
          mapping[newPackageName] = version;
        }
        return mapping;
      },
      {}
    );

    const devDepAdditions = renameDescriptors.reduce(
      (mapping, { newPackageName, version, isDevDep }) => {
        if (isDevDep) {
          mapping[newPackageName] = version;
        }
        return mapping;
      },
      {}
    );

    return chain([
      // rename all the imports before the package.json changes and we can't find the imports
      renamePackageImports(packageNameMapping),
      // add the new name at either the old version or a new version
      addDepsToPackageJson(depAdditions, devDepAdditions),
      // delete the old entry from the package.json
      updateJsonInTree('package.json', (json) => {
        renameDescriptors.forEach(({ packageName, isDevDep }) => {
          if (isDevDep) {
            delete json.devDependencies[packageName];
          } else {
            delete json.dependencies[packageName];
          }
        });

        return json;
      }),
      formatFiles(),
    ]);
  };
}
