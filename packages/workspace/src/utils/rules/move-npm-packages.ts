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
import { formatFiles } from './format-files';

export interface PackageMoveOptions {
  toDeps?: string | string[];
  toDevDeps?: string | string[];
}

interface NormalizedMoveDescriptor {
  packageName: string;
  version: string;
  isDevDep: boolean;
  inPackageJson: boolean;
  goesToDevDep: boolean;
}

const packageToMoveDescriptor = (
  packageJson: any,
  packageName: string,
  goesToDevDep: boolean
): NormalizedMoveDescriptor => {
  const isDevDep =
    !!packageJson.devDependencies && packageName in packageJson.devDependencies;
  const inPackageJson =
    (packageJson.dependencies && packageName in packageJson.dependencies) ||
    isDevDep;
  const version = isDevDep
    ? packageJson.devDependencies[packageName]
    : packageJson.dependencies[packageName];
  return {
    packageName,
    version,
    isDevDep,
    inPackageJson,
    goesToDevDep,
  };
};

const normalizeToMoveDescriptors = (
  packageJson: any,
  toDeps: string[],
  toDevDeps: string[]
): NormalizedMoveDescriptor[] => {
  const normalizedMoveDescriptors = [
    ...toDeps.map((packageName) =>
      packageToMoveDescriptor(packageJson, packageName, false)
    ),
    ...toDevDeps.map((packageName) =>
      packageToMoveDescriptor(packageJson, packageName, true)
    ),
  ];

  return normalizedMoveDescriptors;
};

/**
 * Move packages to deps or devDeps adjusting the package.json appropriately.
 *
 * @param packageMoveOptions The PackageMoveOptions provided to the schematic
 */
export function moveNpmPackages(packageMoveOptions: PackageMoveOptions) {
  return (tree: Tree, context: SchematicContext): Rule => {
    const pkg = readJsonInTree(tree, 'package.json');
    const { toDeps = [], toDevDeps = [] } = packageMoveOptions;

    const moveDescriptors = normalizeToMoveDescriptors(
      pkg,
      Array.isArray(toDeps) ? toDeps : [toDeps],
      Array.isArray(toDevDeps) ? toDevDeps : [toDevDeps]
    ).filter(
      ({ inPackageJson, isDevDep, goesToDevDep }) =>
        inPackageJson &&
        ((isDevDep && !goesToDevDep) || (!isDevDep && goesToDevDep))
    );

    // if no packages are being moved to its oposite group, abort
    if (moveDescriptors.length === 0) {
      return noop();
    }

    const depAdditions = moveDescriptors.reduce(
      (mapping, { packageName, version, goesToDevDep }) => {
        if (!goesToDevDep) {
          mapping[packageName] = version;
        }
        return mapping;
      },
      {}
    );

    const devDepAdditions = moveDescriptors.reduce(
      (mapping, { packageName, version, goesToDevDep }) => {
        if (goesToDevDep) {
          mapping[packageName] = version;
        }
        return mapping;
      },
      {}
    );

    return chain([
      // add the packages to new destination in package.json
      addDepsToPackageJson(depAdditions, devDepAdditions),
      // delete the old entry from the package.json
      updateJsonInTree('package.json', (json) => {
        moveDescriptors.forEach(({ packageName, goesToDevDep }) => {
          if (goesToDevDep) {
            delete json.dependencies[packageName];
          } else {
            delete json.devDependencies[packageName];
          }
        });
        return json;
      }),
      formatFiles(),
    ]);
  };
}
