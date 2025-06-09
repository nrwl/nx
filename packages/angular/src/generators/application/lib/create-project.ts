import {
  addProjectConfiguration,
  joinPathFragments,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export function createProject(tree: Tree, options: NormalizedSchema) {
  let project: ProjectConfiguration;

  if (options.bundler === 'esbuild') {
    project = createProjectForEsbuild(tree, options);
  } else {
    project = createProjectForWebpack(tree, options);
  }

  addProjectConfiguration(tree, options.name, project);
}

function createProjectForEsbuild(tree: Tree, options: NormalizedSchema) {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  const buildExecutor =
    angularMajorVersion >= 20
      ? '@angular/build:application'
      : '@angular-devkit/build-angular:application';

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
          index:
            angularMajorVersion >= 20
              ? undefined
              : `${options.appProjectSourceRoot}/index.html`,
          browser: `${options.appProjectSourceRoot}/main.ts`,
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
        },
        configurations: {
          production: {
            budgets,
            outputHashing: 'all',
          },
          development: {
            optimization: false,
            extractLicenses: false,
            sourceMap: true,
          },
        },
        defaultConfiguration: 'production',
      },
      serve: {
        continuous: true,
        executor:
          angularMajorVersion >= 20
            ? '@angular/build:dev-server'
            : '@angular-devkit/build-angular:dev-server',
        options: options.port ? { port: options.port } : undefined,
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
        executor:
          angularMajorVersion >= 20
            ? '@angular/build:extract-i18n'
            : '@angular-devkit/build-angular:extract-i18n',
        options: {
          buildTarget: `${options.name}:build`,
        },
      },
    },
  };

  return project;
}

function createProjectForWebpack(tree: Tree, options: NormalizedSchema) {
  const buildExecutor = '@angular-devkit/build-angular:browser';

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
          index: `${options.appProjectSourceRoot}/index.html`,
          main: `${options.appProjectSourceRoot}/main.ts`,
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
        },
        configurations: {
          production: {
            budgets,
            outputHashing: 'all',
          },
          development: {
            buildOptimizer: false,
            optimization: false,
            vendorChunk: true,
            extractLicenses: false,
            sourceMap: true,
            namedChunks: true,
          },
        },
        defaultConfiguration: 'production',
      },
      serve: {
        continuous: true,
        executor: '@angular-devkit/build-angular:dev-server',
        options: options.port ? { port: options.port } : undefined,
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

  return project;
}
