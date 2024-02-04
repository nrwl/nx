import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';

import { webpackInitGenerator } from '../init/init';
import { ConfigurationGeneratorSchema } from './schema';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';
import { hasPlugin } from '../../utils/has-plugin';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';
import { ensureDependencies } from '../../utils/ensure-dependencies';

export function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  return configurationGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function configurationGeneratorInternal(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const initTask = await webpackInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(initTask);

  const depsTask = ensureDependencies(tree, {
    compiler: options.compiler === 'babel' ? undefined : options.compiler,
  });
  tasks.push(depsTask);

  checkForTargetConflicts(tree, options);

  if (!hasPlugin(tree)) {
    addBuildTarget(tree, options);
    if (options.devServer) {
      addServeTarget(tree, options);
    }
  }

  createWebpackConfig(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function checkForTargetConflicts(
  tree: Tree,
  options: ConfigurationGeneratorSchema
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

function createWebpackConfig(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
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

  if (options.target === 'web') {
    tree.write(
      joinPathFragments(project.root, 'webpack.config.js'),
      hasPlugin(tree)
        ? `
const { NxWebpackPlugin } = require('@nx/webpack');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '${offsetFromRoot(project.root)}${
            buildOptions.outputPath
          }'),
  },
  plugins: [
    new NxWebpackPlugin({
      target: '${buildOptions.target}',
      tsConfig: '${buildOptions.tsConfig}',
      compiler: '${buildOptions.compiler}',
      main: '${buildOptions.main}',
      outputHashing: '${buildOptions.target !== 'web' ? 'none' : 'all'}',
    })
  ],
}
`
        : `
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
      hasPlugin(tree)
        ? `
const { NxWebpackPlugin } = require('@nx/webpack');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '${offsetFromRoot(project.root)}${
            buildOptions.outputPath
          }'),
  },
  plugins: [
    new NxWebpackPlugin({
      target: '${buildOptions.target}',
      tsConfig: '${buildOptions.tsConfig}',
      compiler: '${buildOptions.compiler}',
      main: '${buildOptions.main}',
      outputHashing: '${buildOptions.target !== 'web' ? 'none' : 'all'}',
    })
  ],
}
`
        : `
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
}

function addBuildTarget(tree: Tree, options: ConfigurationGeneratorSchema) {
  addBuildTargetDefaults(tree, '@nx/webpack:webpack');

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

function addServeTarget(tree: Tree, options: ConfigurationGeneratorSchema) {
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

export default configurationGenerator;
