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
} from '@nrwl/devkit';
import { libraryGenerator as jsLibraryGenerator } from '@nrwl/js';
import { join } from 'path';
import { nxVersion } from '../../utils/versions';
import generatorGenerator from '../generator/generator';
import { CreatePackageSchema } from './schema';
import { NormalizedSchema, normalizeSchema } from './utils/normalize-schema';
import e2eProjectGenerator from '../e2e-project/e2e';

export async function createPackageGenerator(
  host: Tree,
  schema: CreatePackageSchema
) {
  const tasks: GeneratorCallback[] = [];

  const options = normalizeSchema(host, schema);
  const pluginPackageName = await addPresetGenerator(host, {
    ...options,
    skipFormat: true,
  });

  const installTask = addDependenciesToPackageJson(
    host,
    {
      'create-nx-workspace': nxVersion,
    },
    {}
  );
  tasks.push(installTask);

  await createCliPackage(host, options, pluginPackageName);
  if (options.e2eTestRunner !== 'none') {
    tasks.push(await addE2eProject(host, options, pluginPackageName));
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
  if (!host.exists(`${projectRoot}/src/generators/preset`)) {
    await generatorGenerator(host, {
      name: 'preset',
      project: schema.project,
      unitTestRunner: schema.unitTestRunner,
    });
  }

  return readJson(host, join(projectRoot, 'package.json'))?.name;
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
    importPath: options.importPath,
    skipTsConfig: true,
  });

  host.delete(join(options.projectRoot, 'src'));

  // Add the bin entry to the package.json
  updateJson(host, join(options.projectRoot, 'package.json'), (packageJson) => {
    packageJson.bin = {
      [options.name]: './bin/index.js',
    };
    packageJson.dependencies = {
      'create-nx-workspace': nxVersion,
    };
    return packageJson;
  });

  // update project build target to use the bin entry
  const projectConfiguration = readProjectConfiguration(
    host,
    options.projectName
  );
  projectConfiguration.sourceRoot = join(options.projectRoot, 'bin');
  projectConfiguration.targets.build.options.main = join(
    options.projectRoot,
    'bin/index.ts'
  );
  projectConfiguration.targets.build.options.buildableProjectDepsInPackageJsonType =
    'dependencies';
  projectConfiguration.targets.build.dependsOn = ['^build'];
  projectConfiguration.implicitDependencies = [options.project];
  updateProjectConfiguration(host, options.projectName, projectConfiguration);

  // Add bin files to tsconfg.lib.json
  updateJson(
    host,
    join(options.projectRoot, 'tsconfig.lib.json'),
    (tsConfig) => {
      tsConfig.include.push('bin/**/*.ts');
      return tsConfig;
    }
  );

  generateFiles(
    host,
    join(__dirname, './files/create-framework-package'),
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
async function addE2eProject(
  host: Tree,
  options: NormalizedSchema,
  pluginPackageName: string
) {
  const pluginProjectConfiguration = readProjectConfiguration(
    host,
    options.project
  );
  const pluginOutputPath =
    pluginProjectConfiguration.targets.build.options.outputPath;

  const cliProjectConfiguration = readProjectConfiguration(
    host,
    options.projectName
  );
  const cliOutputPath =
    cliProjectConfiguration.targets.build.options.outputPath;

  const e2eTask = await e2eProjectGenerator(host, {
    pluginName: options.projectName,
    projectDirectory: options.projectDirectory,
    pluginOutputPath,
    npmPackageName: options.name,
    minimal: false,
    skipFormat: true,
    rootProject: false,
  });

  const e2eProjectConfiguration = readProjectConfiguration(
    host,
    `${options.projectName}-e2e`
  );
  e2eProjectConfiguration.targets.e2e.dependsOn = ['^build'];
  updateProjectConfiguration(
    host,
    e2eProjectConfiguration.name,
    e2eProjectConfiguration
  );

  // delete the default e2e test file
  host.delete(e2eProjectConfiguration.sourceRoot);

  generateFiles(
    host,
    join(__dirname, './files/e2e'),
    e2eProjectConfiguration.sourceRoot,
    {
      ...options,
      pluginPackageName,
      pluginOutputPath,
      cliOutputPath,
      tmpl: '',
    }
  );

  return e2eTask;
}

export default createPackageGenerator;
export const createPackageSchematic = convertNxGenerator(
  createPackageGenerator
);
