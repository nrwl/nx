import { mergeWith, chain, url, Tree } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree,
  readJsonInTree
} from '@nrwl/workspace';
import {
  jestVersion,
  jestTypesVersion,
  tsJestVersion,
  nxVersion
} from '../../utils/versions';
import { Rule } from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { noop } from 'rxjs';

/**
 * verifies whether the given packageJson dependencies require an update
 * given the deps & devDeps passed in
 */
const requiresAddingOfPackages = (packageJsonFile, deps, devDeps): boolean => {
  let needsDepsUpdate = false;
  let needsDevDepsUpdate = false;

  if (Object.keys(deps).length > 0 && packageJsonFile.dependencies) {
    needsDepsUpdate = !Object.keys(deps).find(
      entry => packageJsonFile.dependencies[entry]
    );
  }

  if (Object.keys(devDeps).length > 0 && packageJsonFile.dependencies) {
    needsDevDepsUpdate = !Object.keys(devDeps).find(
      entry => packageJsonFile.devDependencies[entry]
    );
  }

  return needsDepsUpdate || needsDevDepsUpdate;
};

const removeNrwlJestFromDeps = (host: Tree) => {
  // check whether to update the packge.json is necessary
  const currentPackageJson = readJsonInTree(host, 'package.json');

  if (
    currentPackageJson.dependencies &&
    currentPackageJson.dependencies['@nrwl/jest']
  ) {
    return updateJsonInTree('package.json', json => {
      json.dependencies = json.dependencies || {};
      delete json.dependencies['@nrwl/jest'];
      return json;
    });
  } else {
    return noop();
  }
};

const createJestConfig = (host: Tree) => {
  if (!host.exists('jest.config.js')) {
    host.create(
      'jest.config.js',
      stripIndents`
  module.exports = {
    testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
    transform: {
      '^.+\\.(ts|js|html)$': 'ts-jest'
    },
    resolver: '@nrwl/jest/plugins/resolver',
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageReporters: ['html'],
    passWithNoTests: true
  };`
    );
  }
};

export default function(): Rule {
  return chain([
    createJestConfig,
    addDepsToPackageJson(
      {},
      {
        '@nrwl/jest': nxVersion,
        jest: jestVersion,
        '@types/jest': jestTypesVersion,
        'ts-jest': tsJestVersion
      }
    ),
    removeNrwlJestFromDeps
  ]);
}
