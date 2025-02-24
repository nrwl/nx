import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getPackageManagerCommand,
  joinPathFragments,
  names,
  offsetFromRoot,
  readJson,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  updateJson,
  updateProjectConfiguration,
  writeJson,
  type GeneratorCallback,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { LinterType, lintProjectGenerator } from '@nx/eslint';
import { addPropertyToJestConfig, configurationGenerator } from '@nx/jest';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { setupVerdaccio } from '@nx/js/src/generators/setup-verdaccio/generator';
import { addLocalRegistryScripts } from '@nx/js/src/utils/add-local-registry-scripts';
import { normalizeLinterOption } from '@nx/js/src/utils/generator-prompts';
import {
  addProjectToTsSolutionWorkspace,
  isUsingTsSolutionSetup,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { PackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectName: string;
  pluginPropertyName: string;
  linter: LinterType;
  useProjectJson: boolean;
  addPlugin: boolean;
  isTsSolutionSetup: boolean;
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const linter = await normalizeLinterOption(host, options.linter);

  const projectName = options.rootProject ? 'e2e' : `${options.pluginName}-e2e`;

  const nxJson = readNxJson(host);
  const addPlugin =
    options.addPlugin ??
    (process.env.NX_ADD_PLUGINS !== 'false' &&
      nxJson.useInferencePlugins !== false);

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
  const isTsSolutionSetup = isUsingTsSolutionSetup(host);

  return {
    ...options,
    projectName,
    linter,
    pluginPropertyName,
    projectRoot,
    addPlugin,
    useProjectJson: options.useProjectJson ?? !isTsSolutionSetup,
    isTsSolutionSetup,
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
    packageManagerCommands: getPackageManagerCommand(),
    pluginPackageName,
  });
}

async function addJest(host: Tree, options: NormalizedSchema) {
  const projectConfiguration: ProjectConfiguration = {
    name: options.projectName,
    root: options.projectRoot,
    projectType: 'application',
    sourceRoot: `${options.projectRoot}/src`,
    implicitDependencies: [options.pluginName],
  };

  if (options.isTsSolutionSetup) {
    writeJson<PackageJson>(
      host,
      joinPathFragments(options.projectRoot, 'package.json'),
      {
        name: options.projectName,
        version: '0.0.1',
        private: true,
      }
    );
    updateProjectConfiguration(host, options.projectName, projectConfiguration);
  } else {
    projectConfiguration.targets = {};
    addProjectConfiguration(host, options.projectName, projectConfiguration);
  }

  const jestTask = await configurationGenerator(host, {
    project: options.projectName,
    targetName: 'e2e',
    setupFile: 'none',
    supportTsx: false,
    skipSerializers: true,
    skipFormat: true,
    addPlugin: options.addPlugin,
    compiler: options.isTsSolutionSetup ? 'swc' : undefined,
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
  project.targets ??= {};
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

function updatePluginPackageJson(tree: Tree, options: NormalizedSchema) {
  const { root } = readProjectConfiguration(tree, options.pluginName);
  updateJson(tree, joinPathFragments(root, 'package.json'), (json) => {
    // to publish the plugin, we need to remove the private flag
    delete json.private;
    return json;
  });
}

export async function e2eProjectGenerator(host: Tree, schema: Schema) {
  return await e2eProjectGeneratorInternal(host, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function e2eProjectGeneratorInternal(host: Tree, schema: Schema) {
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
  updatePluginPackageJson(host, options);

  if (options.linter !== 'none') {
    tasks.push(
      await addLintingToApplication(host, {
        ...options,
      })
    );
  }

  if (options.isTsSolutionSetup && !options.rootProject) {
    // update root  tsconfig.json references with the new lib tsconfig
    updateJson(host, 'tsconfig.json', (json) => {
      json.references ??= [];
      json.references.push({
        path: options.projectRoot.startsWith('./')
          ? options.projectRoot
          : './' + options.projectRoot,
      });
      return json;
    });
  }

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isTsSolutionSetup) {
    addProjectToTsSolutionWorkspace(host, options.projectRoot);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default e2eProjectGenerator;
