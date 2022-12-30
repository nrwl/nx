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

import { rollupInitGenerator } from '../init/init';
import { RollupExecutorOptions } from '../../executors/rollup/schema';
import { RollupProjectSchema } from './schema';

export async function rollupProjectGenerator(
  tree: Tree,
  options: RollupProjectSchema
) {
  const task = await rollupInitGenerator(tree, options);
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options);
  await formatFiles(tree);
  return task;
}

function checkForTargetConflicts(tree: Tree, options: RollupProjectSchema) {
  if (options.skipValidation) return;
  const project = readProjectConfiguration(tree, options.project);
  if (project.targets?.build) {
    throw new Error(
      `Project "${options.project}" already has a build target. Pass --skipValidation to ignore this error.`
    );
  }
}

function addBuildTarget(tree: Tree, options: RollupProjectSchema) {
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

  const buildOptions: RollupExecutorOptions = {
    main: options.main ?? joinPathFragments(project.root, 'src/main.ts'),
    outputPath: joinPathFragments('dist', project.root),
    compiler: options.compiler ?? 'babel',
    tsConfig,
    project: `${project.root}/package.json`,
    external: options.external,
  };

  if (options.rollupConfig) {
    buildOptions.rollupConfig = options.rollupConfig;
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
      build: {
        executor: '@nrwl/rollup:rollup',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          production: {
            optimization: true,
            sourceMap: false,
            namedChunks: false,
            extractLicenses: true,
            vendorChunk: false,
          },
        },
      },
    },
  });
}

export default rollupProjectGenerator;

export const rollupProjectSchematic = convertNxGenerator(
  rollupProjectGenerator
);
