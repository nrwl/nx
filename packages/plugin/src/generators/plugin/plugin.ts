import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  normalizePath,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import {
  addSwcDependencies,
  addSwcRegisterDependencies,
} from '@nx/js/src/utils/swc/add-swc-dependencies';
import { addTsLibDependencies } from '@nx/js/src/utils/typescript/add-tslib-dependencies';
import * as path from 'path';
import { e2eProjectGenerator } from '../e2e-project/e2e';
import pluginLintCheckGenerator from '../lint-checks/generator';
import type { Schema } from './schema';
import { NormalizedSchema, normalizeOptions } from './utils/normalize-schema';

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
  const project = readProjectConfiguration(host, options.projectName);

  if (project.targets.build) {
    if (options.isTsSolutionSetup && options.bundler === 'tsc') {
      project.targets.build.options.rootDir =
        project.sourceRoot ?? joinPathFragments(project.root, 'src');
      project.targets.build.options.generatePackageJson = false;
    }

    project.targets.build.options.assets = [
      ...(project.targets.build.options.assets ?? []),
    ];

    const root = options.projectRoot === '.' ? '.' : './' + options.projectRoot;

    if (options.isTsSolutionSetup) {
      project.targets.build.options.assets.push(
        { input: `${root}/src`, glob: '**/!(*.ts)', output: '.' },
        { input: `${root}/src`, glob: '**/*.d.ts', output: '.' }
      );
    } else {
      project.targets.build.options.assets.push(
        { input: `${root}/src`, glob: '**/!(*.ts)', output: './src' },
        { input: `${root}/src`, glob: '**/*.d.ts', output: './src' },
        { input: root, glob: 'generators.json', output: '.' },
        { input: root, glob: 'executors.json', output: '.' }
      );
    }

    updateProjectConfiguration(host, options.projectName, project);
  }
}

export async function pluginGenerator(tree: Tree, schema: Schema) {
  return await pluginGeneratorInternal(tree, {
    useProjectJson: true,
    addPlugin: false,
    ...schema,
  });
}

export async function pluginGeneratorInternal(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsLibraryGenerator(host, {
      ...schema,
      name: options.name,
      directory: options.projectRoot,
      config: 'project',
      bundler: options.bundler,
      publishable: options.publishable,
      importPath: options.importPath,
      linter: options.linter,
      unitTestRunner: options.unitTestRunner,
      useProjectJson: options.useProjectJson,
      addPlugin: options.addPlugin,
      skipFormat: true,
      useTscExecutor: true,
    })
  );

  if (options.isTsSolutionSetup) {
    updateJson(
      host,
      joinPathFragments(options.projectRoot, 'package.json'),
      (json) => {
        delete json.type;
        return json;
      }
    );
  }

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
        [options.unitTestRunner === 'vitest' ? '@nx/vite' : '@nx/jest']:
          nxVersion,
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
        pluginName: options.projectName,
        projectDirectory: options.projectDirectory,
        pluginOutputPath: joinPathFragments(
          'dist',
          options.rootProject ? options.projectName : options.projectRoot
        ),
        npmPackageName: options.importPath,
        skipFormat: true,
        rootProject: options.rootProject,
        linter: options.linter,
        useProjectJson: options.useProjectJson,
        addPlugin: options.addPlugin,
      })
    );
  }

  if (options.linter === Linter.EsLint && !options.skipLintChecks) {
    await pluginLintCheckGenerator(host, { projectName: options.projectName });
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default pluginGenerator;
