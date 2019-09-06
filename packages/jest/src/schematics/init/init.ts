import { mergeWith, chain, url, Tree } from '@angular-devkit/schematics';
import { addDepsToPackageJson, updateJsonInTree } from '@nrwl/workspace';
import {
  jestVersion,
  jestTypesVersion,
  tsJestVersion,
  nxVersion
} from '../../utils/versions';
import { Rule } from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

const updatePackageJson = chain([
  addDepsToPackageJson(
    {},
    {
      '@nrwl/jest': nxVersion,
      jest: jestVersion,
      '@types/jest': jestTypesVersion,
      'ts-jest': tsJestVersion
    }
  ),
  updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};
    delete json.dependencies['@nrwl/jest'];
    return json;
  })
]);

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
  return chain([createJestConfig, updatePackageJson]);
}
