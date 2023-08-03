import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  normalizePath,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import { Linter } from '@nx/linter';
import * as path from 'path';
import { e2eProjectGenerator } from '../e2e-project/e2e';
import pluginLintCheckGenerator from '../lint-checks/generator';
import { NormalizedSchema, normalizeOptions } from './utils/normalize-schema';
import { addTsLibDependencies } from '@nx/js/src/utils/typescript/add-tslib-dependencies';
import { addSwcRegisterDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';

import type { Schema } from './schema';

const nxVersion = require('../../../package.json').version;

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
}

function updatePluginConfig(host: Tree, options: NormalizedSchema) {
  const project = readProjectConfiguration(host, options.name);

  if (project.targets.build) {
    project.targets.build.options.assets ??= [];

    const root = options.projectRoot === '.' ? '.' : './' + options.projectRoot;
    project.targets.build.options.assets = [
      ...project.targets.build.options.assets,
      {
        input: `${root}/src`,
        glob: '**/!(*.ts)',
        output: './src',
      },
      {
        input: `${root}/src`,
        glob: '**/*.d.ts',
        output: './src',
      },
      {
        input: root,
        glob: 'generators.json',
        output: '.',
      },
      {
        input: root,
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

  tasks.push(
    await jsLibraryGenerator(host, {
      ...schema,
      config: 'project',
      bundler: options.bundler,
      publishable: options.publishable,
      importPath: options.npmPackageName,
      skipFormat: true,
    })
  );

  if (options.bundler === 'tsc') {
    tasks.push(addTsLibDependencies(host));
  }

  tasks.push(
    addDependenciesToPackageJson(
      host,
      {
        '@nx/devkit': nxVersion,
      },
      {
        '@nx/jest': nxVersion,
        '@nx/js': nxVersion,
        '@nx/plugin': nxVersion,
      }
    )
  );

  // Ensures Swc Deps are installed to handle running
  // local plugin generators and executors
  tasks.push(addSwcDependencies(host));
  tasks.push(addSwcRegisterDependencies(host));

  await addFiles(host, options);
  updatePluginConfig(host, options);

  if (options.e2eTestRunner !== 'none') {
    tasks.push(
      await e2eProjectGenerator(host, {
        pluginName: options.name,
        projectDirectory: options.projectDirectory,
        pluginOutputPath: `dist/${options.libsDir}/${options.projectDirectory}`,
        npmPackageName: options.npmPackageName,
        skipFormat: true,
        rootProject: options.rootProject,
      })
    );
  }

  if (options.linter === Linter.EsLint && !options.skipLintChecks) {
    await pluginLintCheckGenerator(host, { projectName: options.name });
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default pluginGenerator;
export const pluginSchematic = convertNxGenerator(pluginGenerator);
