import type { Tree } from '@nx/devkit';
import {
  convertNxGenerator,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';

import { webpackInitGenerator } from '../init/init';
import { WebpackProjectGeneratorSchema } from './schema';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';

export async function webpackProjectGenerator(
  tree: Tree,
  options: WebpackProjectGeneratorSchema
) {
  const task = await webpackInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options);
  if (options.devServer) {
    addServeTarget(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

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
    compiler: options.compiler ?? 'swc',
    main: options.main ?? joinPathFragments(project.root, 'src/main.ts'),
    tsConfig:
      options.tsConfig ?? joinPathFragments(project.root, 'tsconfig.app.json'),
    webpackConfig: joinPathFragments(project.root, 'webpack.config.js'),
  };

  if (options.webpackConfig) {
    buildOptions.webpackConfig = options.webpackConfig;
  }

  if (options.babelConfig) {
    buildOptions.babelConfig = options.babelConfig;
  } else if (options.compiler === 'babel') {
    // If no babel config file is provided then write a default one, otherwise build will fail.
    writeJson(tree, joinPathFragments(project.root, '.babelrc'), {
      presets: ['@nx/js/babel'],
    });
  }

  if (options.target === 'web') {
    tree.write(
      joinPathFragments(project.root, 'webpack.config.js'),
      `
const { composePlugins, withNx, withWeb } = require('@nx/webpack');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), withWeb(), (config) => {
  // Update the webpack config as needed here.
  // e.g. \`config.plugins.push(new MyPlugin())\`
  return config;
});
`
    );
  } else {
    tree.write(
      joinPathFragments(project.root, 'webpack.config.js'),
      `
const { composePlugins, withNx } = require('@nx/webpack');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config as needed here.
  // e.g. \`config.plugins.push(new MyPlugin())\`
  return config;
});
`
    );
  }
  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      build: {
        executor: '@nx/webpack:webpack',
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
        executor: '@nx/webpack:dev-server',
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
