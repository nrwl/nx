import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  convertNxGenerator,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

import { webpackInitGenerator } from '../init/init';
import { WebpackProjectGeneratorSchema } from './schema';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';

export async function webpackProjectGenerator(
  tree: Tree,
  options: WebpackProjectGeneratorSchema
) {
  const task = await webpackInitGenerator(tree, options);
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options);
  if (options.devServer) {
    addServeTarget(tree, options);
  }
  await formatFiles(tree);
  return task;
}

function checkForTargetConflicts(
  tree: Tree,
  options: WebpackProjectGeneratorSchema
) {
  if (options.skipValidation) return;

  const project = readProjectConfiguration(tree, options.project);

  if (project.targets?.build) {
    throw new Error(
      `Project "${project.name}" already has a build target. Pass --skipValidation to ignore this error.`
    );
  }

  if (options.devServer && project.targets?.serve) {
    throw new Error(
      `Project "${project.name}" already has a serve target. Pass --skipValidation to ignore this error.`
    );
  }
}

function addBuildTarget(tree: Tree, options: WebpackProjectGeneratorSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const buildOptions: WebpackExecutorOptions = {
    target: options.target,
    outputPath: joinPathFragments('dist', project.root),
    compiler: options.compiler ?? 'babel',
    main: options.main ?? joinPathFragments(project.root, 'src/main.ts'),
    tsConfig:
      options.tsConfig ?? joinPathFragments(project.root, 'tsconfig.app.json'),
  };

  if (options.webpackConfig) {
    buildOptions.webpackConfig = options.webpackConfig;
  }

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      build: {
        executor: '@nrwl/webpack:webpack',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          production: {
            optimization: true,
            outputHashing: options.target === 'web' ? 'all' : 'none',
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

function addServeTarget(tree: Tree, options: WebpackProjectGeneratorSchema) {
  const project = readProjectConfiguration(tree, options.project);
  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      serve: {
        executor: '@nrwl/webpack:dev-server',
        options: {
          buildTarget: `${options.project}:build`,
        },
        configurations: {
          production: {
            buildTarget: `${options.project}:build:production`,
          },
        },
      },
    },
  });
}

export default webpackProjectGenerator;

export const webpackProjectSchematic = convertNxGenerator(
  webpackProjectGenerator
);
