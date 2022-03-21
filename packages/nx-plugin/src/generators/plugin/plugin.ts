import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  normalizePath,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import { nxVersion } from '../../utils/versions';
import * as path from 'path';
import { libraryGenerator } from '@nrwl/js';
import { e2eProjectGenerator } from '../e2e-project/e2e';
import { generatorGenerator } from '../generator/generator';
import { executorGenerator } from '../executor/executor';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  libsDir: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  npmScope: string;
  npmPackageName: string;
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { npmScope, libsDir } = getWorkspaceLayout(host);
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const npmPackageName = options.importPath || `@${npmScope}/${name}`;

  return {
    ...options,
    fileName,
    npmScope,
    libsDir,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    npmPackageName,
  };
}

async function addFiles(host: Tree, options: NormalizedSchema) {
  host.delete(normalizePath(`${options.projectRoot}/src/lib`));

  generateFiles(
    host,
    path.join(__dirname, './files/plugin'),
    options.projectRoot,
    {
      ...options,
      tmpl: '',
    }
  );

  await generatorGenerator(host, {
    project: options.name,
    name: options.name,
    unitTestRunner: options.unitTestRunner,
  });
  await executorGenerator(host, {
    project: options.name,
    name: 'build',
    unitTestRunner: options.unitTestRunner,
  });
}

function updateWorkspaceJson(host: Tree, options: NormalizedSchema) {
  const project = readProjectConfiguration(host, options.name);

  if (project.targets.build) {
    project.targets.build.options.assets ??= [];

    project.targets.build.options.assets = [
      ...project.targets.build.options.assets,
      {
        input: `./${options.projectRoot}/src`,
        glob: '**/!(*.ts)',
        output: './src',
      },
      {
        input: `./${options.projectRoot}/src`,
        glob: '**/*.d.ts',
        output: './src',
      },
      {
        input: `./${options.projectRoot}`,
        glob: 'generators.json',
        output: '.',
      },
      {
        input: `./${options.projectRoot}`,
        glob: 'executors.json',
        output: '.',
      },
    ];

    updateProjectConfiguration(host, options.name, project);
  }
}

export async function pluginGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);
  const tasks: GeneratorCallback[] = [];

  const libraryTask = await libraryGenerator(host, {
    ...schema,
    config: options.standaloneConfig !== false ? 'project' : 'workspace',
    buildable: true,
    importPath: options.npmPackageName,
  });

  tasks.push(libraryTask);

  const installTask = addDependenciesToPackageJson(
    host,
    {},
    {
      '@nrwl/devkit': nxVersion,
      '@nrwl/jest': nxVersion,
      '@nrwl/js': nxVersion,
      tslib: '^2.0.0',
    }
  );
  tasks.push(installTask);

  await addFiles(host, options);
  updateWorkspaceJson(host, options);

  await e2eProjectGenerator(host, {
    pluginName: options.name,
    projectDirectory: options.projectDirectory,
    pluginOutputPath: `dist/${options.libsDir}/${options.projectDirectory}`,
    npmPackageName: options.npmPackageName,
    standaloneConfig: options.standaloneConfig ?? true,
  });

  await formatFiles(host);

  return runTasksInSerial(...tasks);
}

export default pluginGenerator;
export const pluginSchematic = convertNxGenerator(pluginGenerator);
