import {
  addDependenciesToPackageJson,
  readProjectConfiguration,
  Tree,
  generateFiles,
  readJson,
  convertNxGenerator,
  formatFiles,
  updateProjectConfiguration,
  updateJson,
  GeneratorCallback,
  runTasksInSerial,
  joinPathFragments,
  getProjects,
  detectPackageManager,
  getPackageManagerCommand,
} from '@nx/devkit';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { nxVersion } from 'nx/src/utils/versions';
import generatorGenerator from '../generator/generator';
import { CreatePackageSchema } from './schema';
import { NormalizedSchema, normalizeSchema } from './utils/normalize-schema';
import { hasGenerator } from '../../utils/has-generator';
import { join } from 'path';

export async function createPackageGenerator(
  host: Tree,
  schema: CreatePackageSchema
) {
  const tasks: GeneratorCallback[] = [];

  const options = normalizeSchema(host, schema);
  const pluginPackageName = await addPresetGenerator(host, options);

  const installTask = addDependenciesToPackageJson(
    host,
    {
      'create-nx-workspace': nxVersion,
    },
    {}
  );
  tasks.push(installTask);

  await createCliPackage(host, options, pluginPackageName);
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
      project: schema.project,
      unitTestRunner: schema.unitTestRunner,
      skipFormat: true,
    });
  }

  return readJson(host, joinPathFragments(projectRoot, 'package.json'))?.name;
}

async function createCliPackage(
  host: Tree,
  options: NormalizedSchema,
  pluginPackageName: string
) {
  await jsLibraryGenerator(host, {
    ...options,
    rootProject: false,
    config: 'project',
    publishable: true,
    bundler: options.bundler,
    importPath: options.name,
    skipFormat: true,
    skipTsConfig: true,
  });

  host.delete(joinPathFragments(options.projectRoot, 'src'));

  // Add the bin entry to the package.json
  updateJson(
    host,
    joinPathFragments(options.projectRoot, 'package.json'),
    (packageJson) => {
      packageJson.bin = {
        [options.name]: './bin/index.js',
      };
      packageJson.dependencies = {
        'create-nx-workspace': nxVersion,
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
  projectConfiguration.targets.build.options.updateBuildableProjectDepsInPackageJson =
    false;
  projectConfiguration.implicitDependencies = [options.project];
  updateProjectConfiguration(host, options.projectName, projectConfiguration);

  // Add bin files to tsconfg.lib.json
  updateJson(
    host,
    joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    (tsConfig) => {
      tsConfig.include.push('bin/**/*.ts');
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
      packageManagerCommands: getPackageManagerCommand('npm'),
      pluginPackageName,
      tmpl: '',
    }
  );
}

export default createPackageGenerator;
export const createPackageSchematic = convertNxGenerator(
  createPackageGenerator
);
