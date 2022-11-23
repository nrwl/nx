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
  readProjectConfiguration,
  readJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { findRootJestConfig } from '../../utils/config/find-root-jest-files';
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
import { extname } from 'path';

interface NormalizedSchema extends ReturnType<typeof normalizeOptions> {}

const schemaDefaults = {
  compiler: 'tsc',
  js: false,
  rootProject: false,
} as const;

function createJestConfig(tree: Tree, options: NormalizedSchema) {
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
  const rootJestConfig = findRootJestConfig(tree);

  if (options.rootProject && !rootJestConfig) {
    // we don't want any config to be made because the jest-project generator
    // will make the config when using rootProject
    return;
  }
  const isProjectConfig =
    rootJestConfig &&
    tree.exists(rootJestConfig) &&
    !tree.read(rootJestConfig, 'utf-8').includes('getJestProjects()');
  if (!options.rootProject && isProjectConfig) {
    // moving from single project to multi project.
    // TODO(caleb): this is brittle and needs to be detected better?
    const nxJson = readJson(tree, 'nx.json');
    const defaultProject =
      nxJson.cli?.defaultProjectName || nxJson?.defaultProject;

    const ext = extname(rootJestConfig);
    const newJestConfigPath = defaultProject
      ? `jest.${defaultProject}.config${ext}`
      : `jest.project-config${ext}`;

    tree.rename(rootJestConfig, newJestConfigPath);

    if (defaultProject) {
      const projectConfig = readProjectConfiguration(tree, defaultProject);

      // TODO(caleb): do we care about a custom target name?
      if (projectConfig?.targets?.['test']?.options?.jestConfig) {
        projectConfig.targets['test'].options.jestConfig = newJestConfigPath;
        updateProjectConfiguration(tree, defaultProject, projectConfig);
      }
    } else {
      console.warn(stripIndents`Could not find the default project project.json to update the test target options.
Manually update the 'jestConfig' path to point to ${newJestConfigPath}`);
    }
  }

  // if the root ts config already exists then don't make a js one or vice versa
  if (!tree.exists('jest.config.ts') && !tree.exists('jest.config.js')) {
    const contents = options.js
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
    tree.write(`jest.config.${options.js ? 'js' : 'ts'}`, contents);
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
  createJestConfig(tree, options);

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
