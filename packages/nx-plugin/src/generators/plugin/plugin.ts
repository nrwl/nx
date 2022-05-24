import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  installPackagesTask,
  joinPathFragments,
  names,
  normalizePath,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/js';
import { addSwcDependencies } from '@nrwl/js/src/utils/swc/add-swc-dependencies';
import { swcNodeVersion } from 'nx/src/utils/versions';
import * as path from 'path';

import { nxVersion } from '../../utils/versions';
import { e2eProjectGenerator } from '../e2e-project/e2e';
import { executorGenerator } from '../executor/executor';
import { generatorGenerator } from '../generator/generator';

import type { Schema } from './schema';
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
    includeHasher: false,
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

  addDependenciesToPackageJson(
    host,
    {},
    {
      '@nrwl/devkit': nxVersion,
      '@nrwl/jest': nxVersion,
      '@nrwl/js': nxVersion,
      '@swc-node/register': swcNodeVersion,
      tslib: '^2.0.0',
    }
  );

  // Ensures Swc Deps are installed to handle running
  // local plugin generators and executors
  addSwcDependencies(host);

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

  return () => installPackagesTask(host);
}

export default pluginGenerator;
export const pluginSchematic = convertNxGenerator(pluginGenerator);
