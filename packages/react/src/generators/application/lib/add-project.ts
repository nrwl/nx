import { NormalizedSchema } from '../schema';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { maybeJs } from '../../../utils/maybe-js';
import { hasRspackPlugin } from '../../../utils/has-rspack-plugin';

export function addProject(host: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  if (options.bundler === 'webpack') {
    if (!hasWebpackPlugin(host) || !options.addPlugin) {
      project.targets = {
        build: createBuildTarget(options),
        serve: createServeTarget(options),
      };
    }
  } else if (
    options.bundler === 'rspack' &&
    (!hasRspackPlugin(host) || !options.addPlugin)
  ) {
    project.targets = {
      build: createRspackBuildTarget(options),
      serve: createRspackServeTarget(options),
    };
  }

  if (options.isUsingTsSolutionConfig) {
    writeJson(host, joinPathFragments(options.appProjectRoot, 'package.json'), {
      name: options.projectName,
      version: '0.0.1',
      private: true,
    });
  }

  if (!options.isUsingTsSolutionConfig || options.alwaysGenerateProjectJson) {
    addProjectConfiguration(host, options.projectName, {
      ...project,
    });
  } else if (
    options.parsedTags?.length ||
    Object.keys(project.targets).length
  ) {
    const updatedProject: ProjectConfiguration = {
      root: options.appProjectRoot,
      targets: project.targets,
      tags: options.parsedTags?.length ? options.parsedTags : undefined,
    };
    updateProjectConfiguration(host, options.projectName, updatedProject);
  }
}

function createRspackBuildTarget(
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: '@nx/rspack:rspack',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      outputPath: options.isUsingTsSolutionConfig
        ? joinPathFragments(options.appProjectRoot, 'dist')
        : joinPathFragments(
            'dist',
            options.appProjectRoot !== '.'
              ? options.appProjectRoot
              : options.projectName
          ),
      index: joinPathFragments(options.appProjectRoot, 'src/index.html'),
      baseHref: '/',
      main: joinPathFragments(
        options.appProjectRoot,
        maybeJs(options, `src/main.tsx`)
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [
        joinPathFragments(options.appProjectRoot, 'src/favicon.ico'),
        joinPathFragments(options.appProjectRoot, 'src/assets'),
      ],
      rspackConfig: joinPathFragments(
        options.appProjectRoot,
        'rspack.config.js'
      ),
      styles:
        options.styledModule || !options.hasStyles
          ? []
          : [
              joinPathFragments(
                options.appProjectRoot,
                `src/styles.${options.style}`
              ),
            ],
      scripts: [],
      configurations: {
        development: {
          mode: 'development',
        },
        production: {
          mode: 'production',
          optimization: true,
          sourceMap: false,
          outputHashing: 'all',
          namedChunks: false,
          extractLicenses: true,
          vendorChunk: false,
        },
      },
    },
  };
}

function createRspackServeTarget(
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: '@nx/rspack:dev-server',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.projectName}:build`,
      hmr: true,
    },
    configurations: {
      development: {
        buildTarget: `${options.projectName}:build:development`,
      },
      production: {
        buildTarget: `${options.projectName}:build:production`,
        hmr: false,
      },
    },
  };
}

function createBuildTarget(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: '@nx/webpack:webpack',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      compiler: options.compiler ?? 'babel',
      outputPath: options.isUsingTsSolutionConfig
        ? joinPathFragments(options.appProjectRoot, 'dist')
        : joinPathFragments(
            'dist',
            options.appProjectRoot !== '.'
              ? options.appProjectRoot
              : options.projectName
          ),
      index: joinPathFragments(options.appProjectRoot, 'src/index.html'),
      baseHref: '/',
      main: joinPathFragments(
        options.appProjectRoot,
        maybeJs(options, `src/main.tsx`)
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [
        joinPathFragments(options.appProjectRoot, 'src/favicon.ico'),
        joinPathFragments(options.appProjectRoot, 'src/assets'),
      ],
      styles:
        options.styledModule || !options.hasStyles
          ? []
          : [
              joinPathFragments(
                options.appProjectRoot,
                `src/styles.${options.style}`
              ),
            ],
      scripts: [],
      webpackConfig: joinPathFragments(
        options.appProjectRoot,
        'webpack.config.js'
      ),
    },
    configurations: {
      development: {
        extractLicenses: false,
        optimization: false,
        sourceMap: true,
        vendorChunk: true,
      },
      production: {
        fileReplacements: [
          {
            replace: joinPathFragments(
              options.appProjectRoot,
              maybeJs(options, `src/environments/environment.ts`)
            ),
            with: joinPathFragments(
              options.appProjectRoot,
              maybeJs(options, `src/environments/environment.prod.ts`)
            ),
          },
        ],
        optimization: true,
        outputHashing: 'all',
        sourceMap: false,
        namedChunks: false,
        extractLicenses: true,
        vendorChunk: false,
      },
    },
  };
}

function createServeTarget(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: '@nx/webpack:dev-server',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.projectName}:build`,
      hmr: true,
    },
    configurations: {
      development: {
        buildTarget: `${options.projectName}:build:development`,
      },
      production: {
        buildTarget: `${options.projectName}:build:production`,
        hmr: false,
      },
    },
  };
}
