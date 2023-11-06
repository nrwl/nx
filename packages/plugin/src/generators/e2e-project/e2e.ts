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
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { addPropertyToJestConfig, configurationGenerator } from '@nx/jest';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { setupVerdaccio } from '@nx/js/src/generators/setup-verdaccio/generator';
import { addLocalRegistryScripts } from '@nx/js/src/utils/add-local-registry-scripts';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import { join } from 'path';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectName: string;
  pluginPropertyName: string;
  linter: Linter;
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const projectName = options.rootProject ? 'e2e' : `${options.pluginName}-e2e`;

  let projectRoot: string;
  if (options.projectNameAndRootFormat === 'as-provided') {
    const projectNameAndRootOptions = await determineProjectNameAndRootOptions(
      host,
      {
        name: projectName,
        projectType: 'application',
        directory:
          options.rootProject || !options.projectDirectory
            ? projectName
            : `${options.projectDirectory}-e2e`,
        projectNameAndRootFormat: `as-provided`,
        callingGenerator: '@nx/plugin:e2e-project',
      }
    );
    projectRoot = projectNameAndRootOptions.projectRoot;
  } else {
    const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
      options.projectDirectory
    );
    const { appsDir: defaultAppsDir } = getWorkspaceLayout(host);
    const appsDir = layoutDirectory ?? defaultAppsDir;

    projectRoot = options.rootProject
      ? projectName
      : projectDirectory
      ? joinPathFragments(appsDir, `${projectDirectory}-e2e`)
      : joinPathFragments(appsDir, projectName);
  }

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
    setupFile: 'none',
    supportTsx: false,
    skipSerializers: true,
    skipFormat: true,
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
  const testTarget = project.targets.test;

  project.targets.e2e = {
    ...testTarget,
    dependsOn: [`^build`],
    options: {
      ...testTarget.options,
      runInBand: true,
    },
  };

  // remove the jest build target
  delete project.targets.test;

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
    eslintFilePatterns: [`${options.projectRoot}/**/*.ts`],
    unitTestRunner: 'jest',
    skipFormat: true,
    setParserOptionsProject: false,
  });

  return lintTask;
}

export async function e2eProjectGenerator(host: Tree, schema: Schema) {
  return await e2eProjectGeneratorInternal(host, {
    projectNameAndRootFormat: 'derived',
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
