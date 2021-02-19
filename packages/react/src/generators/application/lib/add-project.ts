import { NormalizedSchema } from '../schema';
import {
  joinPathFragments,
  addProjectConfiguration,
  NxJsonProjectConfiguration,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nrwl/devkit';

export function addProject(host, options: NormalizedSchema) {
  const nxConfig: NxJsonProjectConfiguration = {
    tags: options.parsedTags,
  };

  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: {
      build: createBuildTarget(options),
      serve: createServeTarget(options),
    },
  };

  addProjectConfiguration(host, options.projectName, {
    ...project,
    ...nxConfig,
  });
}

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}

function createBuildTarget(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: '@nrwl/web:build',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: joinPathFragments('dist', options.appProjectRoot),
      index: joinPathFragments(options.appProjectRoot, 'src/index.html'),
      main: joinPathFragments(
        options.appProjectRoot,
        maybeJs(options, `src/main.tsx`)
      ),
      polyfills: joinPathFragments(
        options.appProjectRoot,
        maybeJs(options, 'src/polyfills.ts')
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
      webpackConfig: '@nrwl/react/plugins/webpack',
    },
    configurations: {
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
        extractCss: true,
        namedChunks: false,
        extractLicenses: true,
        vendorChunk: false,
        budgets: [
          {
            type: 'initial',
            maximumWarning: '2mb',
            maximumError: '5mb',
          },
        ],
      },
    },
  };
}

function createServeTarget(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: '@nrwl/web:dev-server',
    options: {
      buildTarget: `${options.projectName}:build`,
    },
    configurations: {
      production: {
        buildTarget: `${options.projectName}:build:production`,
      },
    },
  };
}
