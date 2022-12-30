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
  updateProjectConfiguration,
  getProjects,
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
  typesNodeVersion,
} from '../../utils/versions';
import { JestInitSchema } from './schema';

interface NormalizedSchema extends ReturnType<typeof normalizeOptions> {}

const schemaDefaults = {
  compiler: 'tsc',
  js: false,
  rootProject: false,
} as const;

function generateGlobalConfig(tree: Tree, isJS: boolean) {
  const contents = isJS
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
  tree.write(`jest.config.${isJS ? 'js' : 'ts'}`, contents);
}

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
  if (options.rootProject) {
    // we don't want any config to be made because the `jestProjectGenerator`
    // will copy the template config file
    return;
  }
  const rootJestPath = findRootJestConfig(tree);
  if (!rootJestPath) {
    // if there's not root jest config, we will create one and return
    // this can happen when:
    // - root jest config was renamed => in which case there is migration needed
    // - root project didn't have jest setup => again, no migration is needed
    generateGlobalConfig(tree, options.js);
    return;
  }

  if (tree.exists(rootJestPath)) {
    // moving from root project config to monorepo-style config
    const projects = getProjects(tree);
    const projectNames = Array.from(projects.keys());
    const rootProject = projectNames.find(
      (projectName) => projects.get(projectName)?.root === '.'
    );
    // root project might have been removed,
    // if it's missing there's nothing to migrate
    if (rootProject) {
      const rootProjectConfig = projects.get(rootProject);
      const jestTarget = Object.values(rootProjectConfig.targets || {}).find(
        (t) => t?.executor === '@nrwl/jest:jest'
      );
      const isProjectConfig = jestTarget?.options?.jestConfig === rootJestPath;
      // if root project doesn't have jest target, there's nothing to migrate
      if (isProjectConfig) {
        const jestAppConfig = `jest.config.app.${options.js ? 'js' : 'ts'}`;

        tree.rename(rootJestPath, jestAppConfig);
        jestTarget.options.jestConfig = jestAppConfig;
        updateProjectConfiguration(tree, rootProject, rootProjectConfig);
      }
      // generate new global config as it was move to project config or is missing
      generateGlobalConfig(tree, options.js);
    }
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
    devDeps['@types/node'] = typesNodeVersion;
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
