import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { addTsLibDependencies } from '@nx/js/src/utils/typescript/add-tslib-dependencies';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { tsLibVersion } from '@nx/js/src/utils/versions';
import type { PackageJson } from 'nx/src/utils/package-json';
import { nxVersion } from 'nx/src/utils/versions';
import { join } from 'path';
import { hasGenerator } from '../../utils/has-generator';
import { generatorGenerator } from '../generator/generator';
import { CreatePackageSchema } from './schema';
import { NormalizedSchema, normalizeSchema } from './utils/normalize-schema';

export async function createPackageGenerator(
  host: Tree,
  schema: CreatePackageSchema
) {
  return await createPackageGeneratorInternal(host, {
    useProjectJson: true,
    addPlugin: false,
    ...schema,
  });
}

export async function createPackageGeneratorInternal(
  host: Tree,
  schema: CreatePackageSchema
) {
  const tasks: GeneratorCallback[] = [];

  const options = await normalizeSchema(host, schema);
  const pluginPackageName = await addPresetGenerator(host, options);

  if (options.bundler === 'tsc') {
    tasks.push(addTsLibDependencies(host));
  }

  const installTask = addDependenciesToPackageJson(
    host,
    {
      'create-nx-workspace': nxVersion,
    },
    {}
  );
  tasks.push(installTask);

  const cliPackageTask = await createCliPackage(
    host,
    options,
    pluginPackageName
  );
  tasks.push(cliPackageTask);

  if (options.e2eProject) {
    addE2eProject(host, options);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

/**
 * Add a preset generator to the plugin if it doesn't exist
 * @param host
 * @param schema
 * @returns package name of the plugin
 */
async function addPresetGenerator(
  host: Tree,
  schema: NormalizedSchema
): Promise<string> {
  const { root: projectRoot } = readProjectConfiguration(host, schema.project);
  if (!hasGenerator(host, schema.project, 'preset')) {
    await generatorGenerator(host, {
      name: 'preset',
      path: join(projectRoot, 'src/generators/preset/generator'),
      unitTestRunner: schema.unitTestRunner,
      skipFormat: true,
      skipLintChecks: schema.linter === 'none',
    });
  }

  return readJson(host, joinPathFragments(projectRoot, 'package.json'))?.name;
}

async function createCliPackage(
  host: Tree,
  options: NormalizedSchema,
  pluginPackageName: string
) {
  const jsLibraryTask = await jsLibraryGenerator(host, {
    ...options,
    directory: options.directory,
    rootProject: false,
    config: 'project',
    publishable: true,
    bundler: options.bundler,
    importPath: options.name,
    skipFormat: true,
    skipTsConfig: true,
    useTscExecutor: true,
  });

  host.delete(joinPathFragments(options.projectRoot, 'src'));

  const isTsSolutionSetup = isUsingTsSolutionSetup(host);

  // Add the bin entry to the package.json
  updateJson<PackageJson>(
    host,
    joinPathFragments(options.projectRoot, 'package.json'),
    (packageJson) => {
      packageJson.bin = {
        [options.name]: './bin/index.js',
      };
      if (isTsSolutionSetup) {
        packageJson.bin[options.name] = './dist/bin/index.js';
        // this package only exposes a binary entry point and no JS programmatic API
        delete packageJson.main;
        delete packageJson.types;
        delete packageJson.typings;
        delete packageJson.exports;
      }
      packageJson.dependencies = {
        'create-nx-workspace': nxVersion,
        ...(options.bundler === 'tsc' && { tslib: tsLibVersion }),
      };
      return packageJson;
    }
  );

  // update project build target to use the bin entry
  const projectConfiguration = readProjectConfiguration(
    host,
    options.projectName
  );
  projectConfiguration.sourceRoot = joinPathFragments(
    options.projectRoot,
    'bin'
  );
  projectConfiguration.targets.build.options.main = joinPathFragments(
    options.projectRoot,
    'bin/index.ts'
  );
  projectConfiguration.implicitDependencies = [options.project];
  if (options.isTsSolutionSetup) {
    if (options.bundler === 'tsc') {
      projectConfiguration.targets.build.options.generatePackageJson = false;
    } else if (options.bundler === 'swc') {
      delete projectConfiguration.targets.build.options.stripLeadingPaths;
    }
  }
  updateProjectConfiguration(host, options.projectName, projectConfiguration);

  // Add bin files and update rootDir in tsconfg.lib.json
  updateJson(
    host,
    joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    (tsConfig) => {
      tsConfig.include.push('bin/**/*.ts');
      tsConfig.compilerOptions ??= {};
      tsConfig.compilerOptions.rootDir = '.';
      return tsConfig;
    }
  );

  generateFiles(
    host,
    joinPathFragments(__dirname, './files/create-framework-package'),
    options.projectRoot,
    {
      ...options,
      preset: pluginPackageName,
      tmpl: '',
    }
  );

  return jsLibraryTask;
}

/**
 * Add a test file to plugin e2e project
 * @param host
 * @param options
 * @returns
 */
function addE2eProject(host: Tree, options: NormalizedSchema) {
  const e2eProjectConfiguration = readProjectConfiguration(
    host,
    options.e2eProject
  );
  const projectConfiguration = readProjectConfiguration(host, options.project);
  const { name: pluginPackageName } = readJson(
    host,
    join(projectConfiguration.root, 'package.json')
  );

  generateFiles(
    host,
    joinPathFragments(__dirname, './files/e2e'),
    e2eProjectConfiguration.sourceRoot,
    {
      pluginName: options.project,
      cliName: options.name,
      packageManagerCommands: getPackageManagerCommand(),
      pluginPackageName,
      tmpl: '',
    }
  );
}

export default createPackageGenerator;
