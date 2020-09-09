import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  readJsonInTree,
  updateJsonInTree,
} from '@nrwl/workspace';
import { noop } from 'rxjs';
import {
  babelCoreVersion,
  babelJestVersion,
  babelPresetEnvVersion,
  babelPresetReactVersion,
  babelPresetTypescriptVersion,
  jestTypesVersion,
  jestVersion,
  nxVersion,
  tsJestVersion,
} from '../../utils/versions';
import { JestInitSchema } from './schema';

interface NormalizedSchema extends ReturnType<typeof normalizeOptions> {}

const schemaDefaults = {
  babelJest: false,
} as const;

const removeNrwlJestFromDeps = (host: Tree) => {
  // check whether updating the package.json is necessary
  const currentPackageJson = readJsonInTree(host, 'package.json');

  if (
    currentPackageJson.dependencies &&
    currentPackageJson.dependencies['@nrwl/jest']
  ) {
    return updateJsonInTree('package.json', (json) => {
      json.dependencies = json.dependencies || {};
      delete json.dependencies['@nrwl/jest'];
      return json;
    });
  } else {
    return noop();
  }
};

const createJestConfig = (host: Tree) => {
  if (host.exists('jest.config.js')) {
    return;
  }

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
};

function updateDependencies(options: NormalizedSchema): Rule {
  const devDeps = {
    '@nrwl/jest': nxVersion,
    jest: jestVersion,
    '@types/jest': jestTypesVersion,
    'ts-jest': tsJestVersion,
  };

  if (options.babelJest) {
    devDeps['@babel/core'] = babelCoreVersion;
    devDeps['@babel/preset-env'] = babelPresetEnvVersion;
    devDeps['@babel/preset-typescript'] = babelPresetTypescriptVersion;
    devDeps['@babel/preset-react'] = babelPresetReactVersion;
    devDeps['babel-jest'] = babelJestVersion;
  }

  return addDepsToPackageJson({}, devDeps);
}

export default function (schema: JestInitSchema): Rule {
  const options = normalizeOptions(schema);

  return chain([
    createJestConfig,
    updateDependencies(options),
    removeNrwlJestFromDeps,
  ]);
}

function normalizeOptions(options: JestInitSchema) {
  return {
    ...schemaDefaults,
    ...options,
  };
}
