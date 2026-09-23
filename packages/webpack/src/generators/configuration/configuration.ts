import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { webpackInitGenerator } from '../init/init';
import { ConfigurationGeneratorSchema } from './schema';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';
import { hasPlugin } from '../../utils/has-plugin';
import { TS_SOLUTION_SETUP_TSCONFIG_INPUT } from '@nx/js/internal';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { assertSupportedWebpackVersion } from '../../utils/versions';

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
  assertSupportedWebpackVersion(tree);

  const tasks: GeneratorCallback[] = [];
  options.addPlugin = true;

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
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '${offsetFromRoot(project.root)}${
      buildOptions.outputPath
    }'),
  },
  plugins: [
    new NxAppWebpackPlugin({
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
  config.output.clean = true;
  return config;
});
`
    );
  } else {
    tree.write(
      joinPathFragments(project.root, 'webpack.config.js'),
      hasPlugin(tree)
        ? `
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '${offsetFromRoot(project.root)}${
      buildOptions.outputPath
    }'),
  },
  plugins: [
    new NxAppWebpackPlugin({
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
  config.output.clean = true;
  return config;
});
`
    );
  }
}

export default configurationGenerator;
