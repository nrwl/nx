import type { Tree } from '@nrwl/devkit';
import {
  convertNxGenerator,
  formatFiles,
  getImportPath,
  getWorkspaceLayout,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';

import { esbuildInitGenerator } from '../init/init';
import { EsBuildExecutorOptions } from '../../executors/esbuild/schema';
import { EsBuildProjectSchema } from './schema';

export async function esbuildProjectGenerator(
  tree: Tree,
  options: EsBuildProjectSchema
) {
  const task = await esbuildInitGenerator(tree, options);
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options);
  await formatFiles(tree);
  return task;
}

function checkForTargetConflicts(tree: Tree, options: EsBuildProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  if (project.targets.build) {
    throw new Error(`Project "${project.name}" already has a build target.`);
  }

  if (options.devServer && project.targets.serve) {
    throw new Error(`Project "${project.name}" already has a serve target.`);
  }
}

function addBuildTarget(tree: Tree, options: EsBuildProjectSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const packageJsonPath = joinPathFragments(project.root, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    const { npmScope } = getWorkspaceLayout(tree);
    const importPath =
      options.importPath || getImportPath(npmScope, options.project);
    writeJson(tree, packageJsonPath, {
      name: importPath,
      version: '0.0.1',
    });
  }
  const tsConfig =
    options.tsConfig ?? joinPathFragments(project.root, 'tsconfig.lib.json');

  const buildOptions: EsBuildExecutorOptions = {
    main: options.main ?? joinPathFragments(project.root, 'src/main.ts'),
    outputPath: joinPathFragments('dist', project.root),
    outputFileName: 'main.js',
    tsConfig,
    project: `${project.root}/package.json`,
    assets: [],
  };

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
      build: {
        executor: '@nrwl/esbuild:esbuild',
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

export default esbuildProjectGenerator;

export const esbuildProjectSchematic = convertNxGenerator(
  esbuildProjectGenerator
);
