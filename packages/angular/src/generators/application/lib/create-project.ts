import {
  addProjectConfiguration,
  joinPathFragments,
  type Tree,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export function createProject(tree: Tree, options: NormalizedSchema) {
  const buildExecutor =
    options.bundler === 'webpack'
      ? '@angular-devkit/build-angular:browser'
      : '@angular-devkit/build-angular:application';
  const buildMainOptionName =
    options.bundler === 'esbuild' ? 'browser' : 'main';

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const index =
    buildExecutor === '@angular-devkit/build-angular:application' &&
    angularMajorVersion >= 20
      ? undefined
      : `${options.appProjectSourceRoot}/index.html`;

  addBuildTargetDefaults(tree, buildExecutor);

  let budgets = undefined;
  if (options.strict) {
    budgets = [
      { type: 'initial', maximumWarning: '500kb', maximumError: '1mb' },
      {
        type: 'anyComponentStyle',
        maximumWarning: '4kb',
        maximumError: '8kb',
      },
    ];
  } else {
    budgets = [
      { type: 'initial', maximumWarning: '2mb', maximumError: '5mb' },
      {
        type: 'anyComponentStyle',
        maximumWarning: '6kb',
        maximumError: '10kb',
      },
    ];
  }

  const inlineStyleLanguage =
    options?.style !== 'css' ? options.style : undefined;

  const project: AngularProjectConfiguration = {
    name: options.name,
    projectType: 'application',
    prefix: options.prefix,
    root: options.appProjectRoot,
    sourceRoot: options.appProjectSourceRoot,
    tags: options.parsedTags,
    targets: {
      build: {
        executor: buildExecutor,
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: options.outputPath,
          index,
          [buildMainOptionName]: `${options.appProjectSourceRoot}/main.ts`,
          polyfills: ['zone.js'],
          tsConfig: joinPathFragments(
            options.appProjectRoot,
            'tsconfig.app.json'
          ),
          inlineStyleLanguage,
          assets: [
            {
              glob: '**/*',
              input: joinPathFragments(options.appProjectRoot, 'public'),
            },
          ],
          styles: [`${options.appProjectSourceRoot}/styles.${options.style}`],
          scripts: [],
        },
        configurations: {
          production: {
            budgets,
            outputHashing: 'all',
          },
          development: {
            buildOptimizer: options.bundler === 'webpack' ? false : undefined,
            optimization: false,
            vendorChunk: options.bundler === 'webpack' ? true : undefined,
            extractLicenses: false,
            sourceMap: true,
            namedChunks: options.bundler === 'webpack' ? true : undefined,
          },
        },
        defaultConfiguration: 'production',
      },
      serve: {
        continuous: true,
        executor: '@angular-devkit/build-angular:dev-server',
        options: options.port
          ? {
              port: options.port,
            }
          : undefined,
        configurations: {
          production: {
            buildTarget: `${options.name}:build:production`,
          },
          development: {
            buildTarget: `${options.name}:build:development`,
          },
        },
        defaultConfiguration: 'development',
      },
      'extract-i18n': {
        executor: '@angular-devkit/build-angular:extract-i18n',
        options: {
          buildTarget: `${options.name}:build`,
        },
      },
    },
  };

  addProjectConfiguration(tree, options.name, project);
}
