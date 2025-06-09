import type {
  BrowserBuilderOptions,
  ServerBuilderOptions,
} from '@angular-devkit/build-angular';
import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  logger,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedGeneratorOptions } from '../schema';
import {
  DEFAULT_BROWSER_DIR,
  DEFAULT_MEDIA_DIR,
  DEFAULT_SERVER_DIR,
} from './constants';

export function updateProjectConfigForApplicationBuilder(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const project = readProjectConfiguration(tree, options.project);
  const buildTarget = project.targets.build;

  let outputPath = buildTarget.options?.outputPath;
  if (
    outputPath &&
    typeof outputPath !== 'string' &&
    outputPath.browser === ''
  ) {
    const base = outputPath.base as string;
    logger.warn(
      `The output location of the browser build has been updated from "${base}" to "${joinPathFragments(
        base,
        DEFAULT_BROWSER_DIR
      )}".
          You might need to adjust your deployment pipeline.`
    );

    if (
      (outputPath.media && outputPath.media !== DEFAULT_MEDIA_DIR) ||
      (outputPath.server && outputPath.server !== DEFAULT_SERVER_DIR)
    ) {
      delete outputPath.browser;
    } else {
      outputPath = outputPath.base;
      if (buildTarget.outputs && buildTarget.outputs.length > 0) {
        buildTarget.outputs = buildTarget.outputs.map((output) =>
          output === '{options.outputPath.base}'
            ? '{options.outputPath}'
            : output
        );
      }
    }
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const sourceRoot =
    project.sourceRoot ?? joinPathFragments(project.root, 'src');

  buildTarget.options ??= {};
  buildTarget.options.outputPath = outputPath;
  buildTarget.options.server = joinPathFragments(sourceRoot, options.main);

  if (angularMajorVersion >= 19) {
    buildTarget.options.ssr = {
      entry: joinPathFragments(sourceRoot, options.serverFileName),
    };
    if (options.serverRouting) {
      buildTarget.options.outputMode = 'server';
    } else {
      buildTarget.options.prerender = true;
    }
  } else {
    buildTarget.options.prerender = true;
    buildTarget.options.ssr = {
      entry: joinPathFragments(project.root, options.serverFileName),
    };
  }

  updateProjectConfiguration(tree, options.project, project);
}

export function updateProjectConfigForBrowserBuilder(
  tree: Tree,
  options: NormalizedGeneratorOptions
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const buildTarget = projectConfig.targets.build;
  const baseOutputPath = buildTarget.options.outputPath;
  buildTarget.options.outputPath = joinPathFragments(baseOutputPath, 'browser');

  const buildConfigurations = projectConfig.targets.build.configurations;
  const configurations: Record<string, {}> = {};
  if (buildConfigurations) {
    for (const [key, options] of Object.entries(buildConfigurations)) {
      configurations[key] = getServerOptions(options);
    }
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const sourceRoot =
    projectConfig.sourceRoot ?? joinPathFragments(projectConfig.root, 'src');

  projectConfig.targets.server = {
    dependsOn: ['build'],
    executor: buildTarget.executor.startsWith('@angular-devkit/build-angular:')
      ? '@angular-devkit/build-angular:server'
      : '@nx/angular:webpack-server',
    options: {
      outputPath: joinPathFragments(baseOutputPath, 'server'),
      main: joinPathFragments(
        angularMajorVersion >= 19 ? sourceRoot : projectConfig.root,
        options.serverFileName
      ),
      tsConfig: joinPathFragments(projectConfig.root, 'tsconfig.server.json'),
      ...(buildTarget.options ? getServerOptions(buildTarget.options) : {}),
    },
    configurations,
    defaultConfiguration: 'production',
  };

  projectConfig.targets['serve-ssr'] = {
    continuous: true,
    executor: '@angular-devkit/build-angular:ssr-dev-server',
    configurations: {
      development: {
        browserTarget: `${options.project}:build:development`,
        serverTarget: `${options.project}:server:development`,
      },
      production: {
        browserTarget: `${options.project}:build:production`,
        serverTarget: `${options.project}:server:production`,
      },
    },
    defaultConfiguration: 'development',
  };

  projectConfig.targets.prerender = {
    executor: '@angular-devkit/build-angular:prerender',
    options: {
      routes: ['/'],
    },
    configurations: {
      development: {
        browserTarget: `${options.project}:build:development`,
        serverTarget: `${options.project}:server:development`,
      },
      production: {
        browserTarget: `${options.project}:build:production`,
        serverTarget: `${options.project}:server:production`,
      },
    },
    defaultConfiguration: 'production',
  };

  updateProjectConfiguration(tree, options.project, projectConfig);

  const nxJson = readNxJson(tree);
  if (
    nxJson.tasksRunnerOptions?.default?.options?.cacheableOperations &&
    !nxJson.tasksRunnerOptions.default.options.cacheableOperations.includes(
      'server'
    )
  ) {
    nxJson.tasksRunnerOptions.default.options.cacheableOperations.push(
      'server'
    );
  }
  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults.server ??= {};
  nxJson.targetDefaults.server.cache ??= true;
  updateNxJson(tree, nxJson);
}

function getServerOptions(
  options: Partial<BrowserBuilderOptions> = {}
): Partial<ServerBuilderOptions> {
  return {
    buildOptimizer: options?.buildOptimizer,
    outputHashing:
      options?.outputHashing === 'all'
        ? ('media' as any)
        : options?.outputHashing,
    fileReplacements: options?.fileReplacements,
    optimization:
      options?.optimization === undefined ? undefined : !!options?.optimization,
    sourceMap: options?.sourceMap,
    stylePreprocessorOptions: options?.stylePreprocessorOptions,
    resourcesOutputPath: options?.resourcesOutputPath,
    deployUrl: options?.deployUrl,
    i18nMissingTranslation: options?.i18nMissingTranslation,
    preserveSymlinks: options?.preserveSymlinks,
    extractLicenses: options?.extractLicenses,
    inlineStyleLanguage: options?.inlineStyleLanguage,
    vendorChunk: options?.vendorChunk,
  };
}
