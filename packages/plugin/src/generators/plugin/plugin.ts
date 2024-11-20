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
  updateProjectConfiguration,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import {
  getProjectPackageManagerWorkspaceState,
  getProjectPackageManagerWorkspaceStateWarningTask,
} from '@nx/js/src/utils/package-manager-workspaces';
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
  const project = readProjectConfiguration(host, options.name);

  if (project.targets.build) {
    if (options.isTsSolutionSetup && options.bundler === 'tsc') {
      project.targets.build.options.rootDir = project.sourceRoot;
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

    updateProjectConfiguration(host, options.name, project);
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
      importPath: options.npmPackageName,
      linter: options.linter,
      unitTestRunner: options.unitTestRunner,
      useProjectJson: options.useProjectJson,
      addPlugin: options.addPlugin,
      skipFormat: true,
      skipWorkspacesWarning: true,
      useTscExecutor: true,
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
        pluginOutputPath: joinPathFragments(
          'dist',
          options.rootProject ? options.name : options.projectRoot
        ),
        npmPackageName: options.npmPackageName,
        skipFormat: true,
        rootProject: options.rootProject,
        linter: options.linter,
        useProjectJson: options.useProjectJson,
        addPlugin: options.addPlugin,
        skipWorkspacesWarning: true,
      })
    );
  }

  if (options.linter === Linter.EsLint && !options.skipLintChecks) {
    await pluginLintCheckGenerator(host, { projectName: options.name });
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  if (options.isTsSolutionSetup) {
    const projectPackageManagerWorkspaceState =
      getProjectPackageManagerWorkspaceState(host, options.projectRoot);

    if (projectPackageManagerWorkspaceState !== 'included') {
      tasks.push(
        getProjectPackageManagerWorkspaceStateWarningTask(
          projectPackageManagerWorkspaceState,
          host.root
        )
      );
    }
  }

  return runTasksInSerial(...tasks);
}

export default pluginGenerator;
