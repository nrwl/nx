import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  readWorkspaceConfiguration,
  removeDependenciesFromPackageJson,
  stripIndents,
  Tree,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import {
  babelJestVersion,
  jestTypesVersion,
  jestVersion,
  nxVersion,
  swcJestVersion,
  tsJestVersion,
  tslibVersion,
  tsNodeVersion,
} from '../../utils/versions';
import { JestInitSchema } from './schema';

interface NormalizedSchema extends ReturnType<typeof normalizeOptions> {}

const schemaDefaults = {
  compiler: 'tsc',
  js: false,
} as const;

function createJestConfig(tree: Tree, js: boolean = false) {
  // if the root ts config already exists then don't make a js one or vice versa
  if (!tree.exists('jest.config.ts') && !tree.exists('jest.config.js')) {
    const contents = js
      ? stripIndents`
      const { getJestProjects } = require('@nrwl/jest');

      module.exports = {
        projects: getJestProjects()
      };`
      : stripIndents`
      import { getJestProjects } from '@nrwl/jest';

      export default {
       projects: getJestProjects()
      };`;
    tree.write(`jest.config.${js ? 'js' : 'ts'}`, contents);
  }

  if (!tree.exists('jest.preset.js')) {
    // preset is always js file.
    tree.write(
      `jest.preset.js`,
      `
      const nxPreset = require('@nrwl/jest/preset').default;
     
      module.exports = { ...nxPreset }`
    );

    addTestInputs(tree);
  }
}

function addTestInputs(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const productionFileSet = workspaceConfiguration.namedInputs?.production;
  if (productionFileSet) {
    // This is one of the patterns in the default jest patterns
    productionFileSet.push(
      // Remove spec, test, and snapshots from the production fileset
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      // Remove tsconfig.spec.json
      '!{projectRoot}/tsconfig.spec.json',
      // Remove jest.config.js/ts
      '!{projectRoot}/jest.config.[jt]s'
    );
    // Dedupe and set
    workspaceConfiguration.namedInputs.production = Array.from(
      new Set(productionFileSet)
    );
  }

  // Test targets depend on all their project's sources + production sources of dependencies
  workspaceConfiguration.targetDefaults ??= {};
  workspaceConfiguration.targetDefaults.test ??= {};
  workspaceConfiguration.targetDefaults.test.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];
  workspaceConfiguration.targetDefaults.test.inputs.push(
    '{workspaceRoot}/jest.preset.js'
  );

  updateWorkspaceConfiguration(tree, workspaceConfiguration);
}

function updateDependencies(tree: Tree, options: NormalizedSchema) {
  const dependencies = {
    tslib: tslibVersion,
  };
  const devDeps = {
    '@nrwl/jest': nxVersion,
    jest: jestVersion,
    'jest-environment-jsdom': jestVersion,

    // because the default jest-preset uses ts-jest,
    // jest will throw an error if it's not installed
    // even if not using it in overriding transformers
    'ts-jest': tsJestVersion,
  };

  if (!options.js) {
    devDeps['ts-node'] = tsNodeVersion;
    devDeps['@types/jest'] = jestTypesVersion;
    devDeps['@types/node'] = '16.11.7';
  }

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
  createJestConfig(tree, options.js);

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
