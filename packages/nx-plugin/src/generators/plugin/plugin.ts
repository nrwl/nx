import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  installPackagesTask,
  normalizePath,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/js';
import { Linter } from '@nrwl/linter';
import { addSwcDependencies } from '@nrwl/js/src/utils/swc/add-swc-dependencies';
import { swcNodeVersion } from 'nx/src/utils/versions';
import * as path from 'path';

import { nxVersion } from '../../utils/versions';
import { e2eProjectGenerator } from '../e2e-project/e2e';
import { executorGenerator } from '../executor/executor';
import { generatorGenerator } from '../generator/generator';
import pluginLintCheckGenerator from '../lint-checks/generator';
import { NormalizedSchema, normalizeOptions } from './utils/normalize-schema';

import type { Schema } from './schema';

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

  if (!options.minimal) {
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

  await libraryGenerator(host, {
    ...schema,
    config: options.standaloneConfig !== false ? 'project' : 'workspace',
    buildable: true,
    importPath: options.npmPackageName,
  });

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
  if (options.linter === Linter.EsLint && !options.skipLintChecks) {
    await pluginLintCheckGenerator(host, { projectName: options.name });
  }

  await formatFiles(host);

  return () => installPackagesTask(host);
}

export default pluginGenerator;
export const pluginSchematic = convertNxGenerator(pluginGenerator);
