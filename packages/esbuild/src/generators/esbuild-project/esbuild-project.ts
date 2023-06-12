import type { Tree } from '@nx/devkit';
import {
  convertNxGenerator,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';

import { getImportPath } from '@nx/js/src/utils/get-import-path';

import { esbuildInitGenerator } from '../init/init';
import { EsBuildExecutorOptions } from '../../executors/esbuild/schema';
import { EsBuildProjectSchema } from './schema';

export async function esbuildProjectGenerator(
  tree: Tree,
  options: EsBuildProjectSchema
) {
  const task = await esbuildInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  options.buildTarget ??= 'build';
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options);
  await formatFiles(tree);
  return task;
}

function checkForTargetConflicts(tree: Tree, options: EsBuildProjectSchema) {
  if (options.skipValidation) return;
  const project = readProjectConfiguration(tree, options.project);
  if (project.targets?.[options.buildTarget]) {
    throw new Error(
      `Project "${options.project}" already has a ${options.buildTarget} target. Pass --skipValidation to ignore this error.`
    );
  }
}

function addBuildTarget(tree: Tree, options: EsBuildProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const packageJsonPath = joinPathFragments(project.root, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    const importPath =
      options.importPath || getImportPath(tree, options.project);
    writeJson(tree, packageJsonPath, {
      name: importPath,
      version: '0.0.1',
    });
  }
  const tsConfig = getTsConfigFile(tree, options);

  const buildOptions: EsBuildExecutorOptions = {
    main: getMainFile(tree, options),
    outputPath: joinPathFragments(
      'dist',
      project.root === '.' ? options.project : project.root
    ),
    outputFileName: 'main.js',
    tsConfig,
    assets: [],
    platform: options.platform,
  };

  if (options.platform === 'browser') {
    buildOptions.outputHashing = 'all';
    buildOptions.minify = true;
  }

  if (tree.exists(joinPathFragments(project.root, 'README.md'))) {
    buildOptions.assets = [
      {
        glob: `${project.root}/README.md`,
        input: '.',
        output: '.',
      },
    ];
  }

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      [options.buildTarget]: {
        executor: '@nx/esbuild:esbuild',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          development: {
            minify: false,
          },
          production: {
            minify: true,
          },
        },
      },
    },
  });
}

function getMainFile(tree: Tree, options: EsBuildProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const candidates = [
    joinPathFragments(project.root, 'src/main.ts'),
    joinPathFragments(project.root, 'src/index.ts'),
  ];
  for (const file of candidates) {
    if (tree.exists(file)) return file;
  }
  return options.main;
}

function getTsConfigFile(tree: Tree, options: EsBuildProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const candidates = [
    joinPathFragments(project.root, 'tsconfig.lib.json'),
    joinPathFragments(project.root, 'tsconfig.app.json'),
  ];
  for (const file of candidates) {
    if (tree.exists(file)) return file;
  }
  return options.tsConfig;
}

export const esbuildProjectSchematic = convertNxGenerator(
  esbuildProjectGenerator
);

export default esbuildProjectGenerator;
