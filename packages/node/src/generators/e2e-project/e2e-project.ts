import * as path from 'path';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  extractLayoutDirectory,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';

import { Schema } from './schema';
import { axiosVersion } from '../../utils/versions';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

export async function e2eProjectGenerator(host: Tree, _options: Schema) {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(host, _options);
  const appProject = readProjectConfiguration(host, options.project);

  addProjectConfiguration(host, options.e2eProjectName, {
    root: options.e2eProjectRoot,
    implicitDependencies: [options.project],
    targets: {
      e2e: {
        executor: '@nrwl/jest:jest',
        outputs: ['{workspaceRoot}/coverage/{e2eProjectRoot}'],
        options: {
          jestConfig: `${options.e2eProjectRoot}/jest.config.ts`,
          passWithNoTests: true,
        },
      },
    },
  });

  if (options.projectType === 'server') {
    generateFiles(
      host,
      path.join(__dirname, 'files/server'),
      options.e2eProjectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'server' : options.project),
        offsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
        tmpl: '',
      }
    );
  } else if (options.projectType === 'cli') {
    const mainFile = appProject.targets.build?.options?.outputPath;
    generateFiles(
      host,
      path.join(__dirname, 'files/cli'),
      options.e2eProjectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'server' : options.project),
        mainFile,
        offsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
        tmpl: '',
      }
    );
  }

  // axios is more than likely used in the application code, so install it as a regular dependency.
  const installTask = addDependenciesToPackageJson(
    host,
    { axios: axiosVersion },
    {}
  );
  tasks.push(installTask);

  if (options.linter === 'eslint') {
    const linterTask = await lintProjectGenerator(host, {
      project: options.e2eProjectName,
      linter: Linter.EsLint,
      skipFormat: true,
      tsConfigPaths: [
        joinPathFragments(options.e2eProjectRoot, 'tsconfig.json'),
      ],
      eslintFilePatterns: [`${options.e2eProjectRoot}/**/*.{js,ts}`],
      setParserOptionsProject: false,
      skipPackageJson: false,
      rootProject: options.rootProject,
    });
    tasks.push(linterTask);
  }

  if (options.formatFile) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

function normalizeOptions(
  tree: Tree,
  options: Schema
): Omit<Schema, 'name'> & { e2eProjectRoot: string; e2eProjectName: string } {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const appsDir = layoutDirectory ?? getWorkspaceLayout(tree).appsDir;
  const name = options.name ?? `${options.project}-e2e`;

  const appDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${names(name).fileName}`
    : names(name).fileName;

  const e2eProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');

  const e2eProjectRoot = options.rootProject
    ? 'e2e'
    : joinPathFragments(appsDir, appDirectory);

  return {
    ...options,
    e2eProjectRoot,
    e2eProjectName,
    port: options.port ?? 3000,
    rootProject: !!options.rootProject,
  };
}

export default e2eProjectGenerator;
export const e2eProjectSchematic = convertNxGenerator(e2eProjectGenerator);
