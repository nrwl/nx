import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  stripIndents,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import {
  babelJestVersion,
  jestTypesVersion,
  jestVersion,
  nxVersion,
  swcJestVersion,
  tsJestVersion,
  tslibVersion,
} from '../../utils/versions';
import { JestInitSchema } from './schema';

interface NormalizedSchema extends ReturnType<typeof normalizeOptions> {}

const schemaDefaults = {
  compiler: 'tsc',
} as const;

function createJestConfig(host: Tree) {
  if (!host.exists('jest.config.ts')) {
    host.write(
      'jest.config.ts',
      stripIndents`
  const { getJestProjects } = require('@nrwl/jest');

  module.exports = {
    projects: getJestProjects()
  };`
    );
  }

  if (!host.exists('jest.preset.ts')) {
    host.write(
      'jest.preset.ts',
      `
      const nxPreset = require('@nrwl/jest/preset');
     
      module.exports = { ...nxPreset }`
    );
  }
}

function updateDependencies(tree: Tree, options: NormalizedSchema) {
  const dependencies = {
    tslib: tslibVersion,
  };
  const devDeps = {
    '@nrwl/jest': nxVersion,
    jest: jestVersion,
    '@types/jest': jestTypesVersion,
    '@types/node': '16.11.7',
    // because the default jest-preset uses ts-jest,
    // jest will throw an error if it's not installed
    // even if not using it in overriding transformers
    'ts-jest': tsJestVersion,
  };

  if (options.compiler === 'babel' || options.babelJest) {
    devDeps['babel-jest'] = babelJestVersion;
    // in some cases @nrwl/web will not already be present i.e. node only projects
    devDeps['@nrwl/web'] = nxVersion;
  } else if (options.compiler === 'swc') {
    devDeps['@swc/jest'] = swcJestVersion;
  }

  return addDependenciesToPackageJson(tree, dependencies, devDeps);
}

function updateExtensions(host: Tree) {
  if (!host.exists('.vscode/extensions.json')) {
    return;
  }

  updateJson(host, '.vscode/extensions.json', (json) => {
    json.recommendations = json.recommendations || [];
    const extension = 'firsttris.vscode-jest-runner';
    if (!json.recommendations.includes(extension)) {
      json.recommendations.push(extension);
    }
    return json;
  });
}

export function jestInitGenerator(tree: Tree, schema: JestInitSchema) {
  const options = normalizeOptions(schema);
  createJestConfig(tree);

  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    removeDependenciesFromPackageJson(tree, ['@nrwl/jest'], []);
    installTask = updateDependencies(tree, options);
  }

  updateExtensions(tree);
  return installTask;
}

function normalizeOptions(options: JestInitSchema) {
  return {
    ...schemaDefaults,
    ...options,
  };
}

export default jestInitGenerator;

export const jestInitSchematic = convertNxGenerator(jestInitGenerator);
