import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  readJsonInTree,
  updateJsonInTree
} from '@nrwl/workspace';
import {
  jestTypesVersion,
  jestVersion,
  nxVersion,
  tsJestVersion
} from '../../utils/versions';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { noop } from 'rxjs';

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
    coverageReporters: ['html']
  };`
    );
  }
};

const updateDependencies = addDepsToPackageJson(
  {},
  {
    '@nrwl/jest': nxVersion,
    jest: jestVersion,
    '@types/jest': jestTypesVersion,
    'ts-jest': tsJestVersion
  }
);

export default function(): Rule {
  return chain([createJestConfig, updateDependencies, removeNrwlJestFromDeps]);
}
