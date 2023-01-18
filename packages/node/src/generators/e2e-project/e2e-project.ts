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

  addProjectConfiguration(host, options.projectName, {
    root: options.projectRoot,
    targets: {
      e2e: {
        executor: '@nrwl/jest:jest',
        outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
        options: {
          jestConfig: `${options.projectRoot}/jest.config.ts`,
          passWithNoTests: true,
        },
      },
    },
  });

  if (options.projectType === 'server') {
    generateFiles(
      host,
      path.join(__dirname, 'files/server'),
      options.projectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'server' : options.project),
        offsetFromRoot: offsetFromRoot(options.projectRoot),
        tmpl: '',
      }
    );
  } else if (options.projectType === 'cli') {
    const mainFile = appProject.targets.build?.options?.outputPath;
    generateFiles(
      host,
      path.join(__dirname, 'files/cli'),
      options.projectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'server' : options.project),
        mainFile,
        offsetFromRoot: offsetFromRoot(options.projectRoot),
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
      project: options.projectName,
      linter: Linter.EsLint,
      skipFormat: true,
      tsConfigPaths: [joinPathFragments(options.projectRoot, 'tsconfig.json')],
      eslintFilePatterns: [`${options.projectRoot}/**/*.{js,ts}`],
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
): Omit<Schema, 'name'> & { projectRoot: string; projectName: string } {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const appsDir = layoutDirectory ?? getWorkspaceLayout(tree).appsDir;
  const name = options.name ?? `${options.project}-e2e`;

  const appDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${names(name).fileName}`
    : names(name).fileName;

  const projectName = appDirectory.replace(new RegExp('/', 'g'), '-');

  const projectRoot = options.rootProject
    ? 'e2e'
    : joinPathFragments(appsDir, appDirectory);

  return {
    ...options,
    projectRoot,
    projectName,
    port: options.port ?? 3000,
    rootProject: !!options.rootProject,
  };
}

export default e2eProjectGenerator;
export const e2eProjectSchematic = convertNxGenerator(e2eProjectGenerator);
