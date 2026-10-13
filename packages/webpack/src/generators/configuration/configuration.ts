import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  writeJson,
} from '@nx/devkit';

import { webpackInitGenerator } from '../init/init';
import { ConfigurationGeneratorSchema } from './schema';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { assertSupportedWebpackVersion } from '../../utils/versions';

export function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  return configurationGeneratorInternal(tree, options);
}

export async function configurationGeneratorInternal(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  assertSupportedWebpackVersion(tree);

  const tasks: GeneratorCallback[] = [];

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

  if (options.babelConfig) {
    buildOptions.babelConfig = options.babelConfig;
  } else if (options.compiler === 'babel') {
    // Without a config file babel-loader looks for <projectRoot>/.babelrc and the build fails.
    writeJson(tree, joinPathFragments(project.root, '.babelrc'), {
      presets: ['@nx/js/babel'],
    });
  }

  tree.write(
    joinPathFragments(project.root, 'webpack.config.js'),
    `
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
      compiler: '${buildOptions.compiler}',${
        buildOptions.babelConfig
          ? `
      babelConfig: '${buildOptions.babelConfig}',`
          : ''
      }
      main: '${buildOptions.main}',
      outputHashing: '${buildOptions.target !== 'web' ? 'none' : 'all'}',
    })
  ],
}
`
  );
}

export default configurationGenerator;
