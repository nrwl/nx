import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
  babelJestVersion,
  jestTypesVersion,
  jestVersion,
  nxVersion,
  swcJestVersion,
  tsJestVersion,
  tslibVersion,
  tsNodeVersion,
  typesNodeVersion,
} from '../../../utils/versions';
import type { NormalizedJestProjectSchema } from '../schema';

export function ensureDependencies(
  tree: Tree,
  options: Partial<NormalizedJestProjectSchema>
) {
  const dependencies: Record<string, string> = {
    tslib: tslibVersion,
  };
  const devDeps: Record<string, string> = {
    // because the default jest-preset uses ts-jest,
    // jest will throw an error if it's not installed
    // even if not using it in overriding transformers
    'ts-jest': tsJestVersion,
  };

  if (options.testEnvironment !== 'none') {
    devDeps[`jest-environment-${options.testEnvironment}`] = jestVersion;
  }

  if (!options.js) {
    devDeps['ts-node'] = tsNodeVersion;
    devDeps['@types/jest'] = jestTypesVersion;
    devDeps['@types/node'] = typesNodeVersion;
  }

  if (options.compiler === 'babel' || options.babelJest) {
    devDeps['babel-jest'] = babelJestVersion;
    // in some cases @nx/js will not already be present i.e. node only projects
    devDeps['@nx/js'] = nxVersion;
  } else if (options.compiler === 'swc') {
    devDeps['@swc/jest'] = swcJestVersion;
  }

  return addDependenciesToPackageJson(tree, dependencies, devDeps);
}
