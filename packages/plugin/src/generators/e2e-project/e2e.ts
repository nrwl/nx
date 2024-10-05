import type { Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  extractLayoutDirectory,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  readJson,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { addPropertyToJestConfig, configurationGenerator } from '@nx/jest';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { setupVerdaccio } from '@nx/js/src/generators/setup-verdaccio/generator';
import { addLocalRegistryScripts } from '@nx/js/src/utils/add-local-registry-scripts';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { Linter, LinterType, lintProjectGenerator } from '@nx/eslint';
import { join } from 'path';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectName: string;
  pluginPropertyName: string;
  linter: Linter | LinterType;
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const projectName = options.rootProject ? 'e2e' : `${options.pluginName}-e2e`;

  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  let projectRoot: string;
  const projectNameAndRootOptions = await determineProjectNameAndRootOptions(
    host,
    {
      name: projectName,
      projectType: 'application',
      directory:
        options.rootProject || !options.projectDirectory
          ? projectName
          : `${options.projectDirectory}-e2e`,
    }
  );
  projectRoot = projectNameAndRootOptions.projectRoot;

  const pluginPropertyName = names(options.pluginName).propertyName;

  return {
    ...options,
    projectName,
    linter: options.linter ?? Linter.EsLint,
    pluginPropertyName,
    projectRoot,
  };
}

function validatePlugin(host: Tree, pluginName: string) {
  try {
    readProjectConfiguration(host, pluginName);
  } catch {
    throw new Error(`Project name "${pluginName}" doesn't not exist.`);
  }
}

function addFiles(host: Tree, options: NormalizedSchema) {
  const projectConfiguration = readProjectConfiguration(
    host,
    options.pluginName
  );
  const { name: pluginPackageName } = readJson(
    host,
    join(projectConfiguration.root, 'package.json')
  );

  generateFiles(host, join(__dirname, './files'), options.projectRoot, {
    ...options,
    tmpl: '',
    rootTsConfigPath: getRelativePathToRootTsConfig(host, options.projectRoot),
    packageManagerCommands: getPackageManagerCommand('npm'),
    pluginPackageName,
  });
}

async function addJest(host: Tree, options: NormalizedSchema) {
  addProjectConfiguration(host, options.projectName, {
    root: options.projectRoot,
    projectType: 'application',
    sourceRoot: `${options.projectRoot}/src`,
    targets: {},
    implicitDependencies: [options.pluginName],
  });

  const jestTask = await configurationGenerator(host, {
    project: options.projectName,
    targetName: 'e2e',
    setupFile: 'none',
    supportTsx: false,
    skipSerializers: true,
    skipFormat: true,
    addPlugin: options.addPlugin,
  });

  const { startLocalRegistryPath, stopLocalRegistryPath } =
    addLocalRegistryScripts(host);

  addPropertyToJestConfig(
    host,
    join(options.projectRoot, 'jest.config.ts'),
    'globalSetup',
    join(offsetFromRoot(options.projectRoot), startLocalRegistryPath)
  );
  addPropertyToJestConfig(
    host,
    join(options.projectRoot, 'jest.config.ts'),
    'globalTeardown',
    join(offsetFromRoot(options.projectRoot), stopLocalRegistryPath)
  );

  const project = readProjectConfiguration(host, options.projectName);
  const e2eTarget = project.targets.e2e;

  project.targets.e2e = {
    ...e2eTarget,
    dependsOn: [`^build`],
    options: {
      ...e2eTarget.options,
      runInBand: true,
    },
  };

  updateProjectConfiguration(host, options.projectName, project);

  return jestTask;
}

async function addLintingToApplication(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const lintTask = await lintProjectGenerator(tree, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: 'jest',
    skipFormat: true,
    setParserOptionsProject: false,
    addPlugin: options.addPlugin,
  });

  return lintTask;
}

export async function e2eProjectGenerator(host: Tree, schema: Schema) {
  return await e2eProjectGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function e2eProjectGeneratorInternal(host: Tree, schema: Schema) {
  assertNotUsingTsSolutionSetup(host, 'plugin', 'e2e-project');

  const tasks: GeneratorCallback[] = [];

  validatePlugin(host, schema.pluginName);
  const options = await normalizeOptions(host, schema);
  addFiles(host, options);
  tasks.push(
    await setupVerdaccio(host, {
      skipFormat: true,
    })
  );
  tasks.push(await addJest(host, options));

  if (options.linter !== Linter.None) {
    tasks.push(
      await addLintingToApplication(host, {
        ...options,
      })
    );
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default e2eProjectGenerator;
