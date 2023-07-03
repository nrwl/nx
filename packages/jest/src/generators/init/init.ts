import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  getProjects,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  stripIndents,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

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
  testEnvironment: 'jsdom',
} as const;

function generateGlobalConfig(tree: Tree, isJS: boolean) {
  const contents = isJS
    ? stripIndents`
    const { getJestProjects } = require('@nx/jest');

    module.exports = {
      projects: getJestProjects()
    };`
    : stripIndents`
    import { getJestProjects } from '@nx/jest';

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
      const nxPreset = require('@nx/jest/preset').default;

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
        (t) =>
          t?.executor === '@nx/jest:jest' || t?.executor === '@nrwl/jest:jest'
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
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    // This is one of the patterns in the default jest patterns
    productionFileSet.push(
      // Remove spec, test, and snapshots from the production fileset
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      // Remove tsconfig.spec.json
      '!{projectRoot}/tsconfig.spec.json',
      // Remove jest.config.js/ts
      '!{projectRoot}/jest.config.[jt]s',
      // Remove test-setup.js/ts
      '!{projectRoot}/src/test-setup.[jt]s'
    );
    // Dedupe and set
    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  // Test targets depend on all their project's sources + production sources of dependencies
  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults.test ??= {};
  nxJson.targetDefaults.test.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];
  nxJson.targetDefaults.test.inputs.push('{workspaceRoot}/jest.preset.js');

  updateNxJson(tree, nxJson);
}

function updateDependencies(tree: Tree, options: NormalizedSchema) {
  const dependencies = {
    tslib: tslibVersion,
  };
  const devDeps = {
    '@nx/jest': nxVersion,
    jest: jestVersion,

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

export async function jestInitGenerator(
  tree: Tree,
  schema: JestInitSchema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(schema);
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      skipFormat: true,
    })
  );

  createJestConfig(tree, options);

  if (!options.skipPackageJson) {
    removeDependenciesFromPackageJson(tree, ['@nx/jest'], []);
    const installTask = updateDependencies(tree, options);
    tasks.push(installTask);
  }

  updateExtensions(tree);
  return runTasksInSerial(...tasks);
}

function normalizeOptions(options: JestInitSchema) {
  return {
    ...schemaDefaults,
    ...options,
  };
}

export default jestInitGenerator;

export const jestInitSchematic = convertNxGenerator(jestInitGenerator);
