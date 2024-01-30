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
import type { Schema } from '../schema';
import {
  DEFAULT_BROWSER_DIR,
  DEFAULT_MEDIA_DIR,
  DEFAULT_SERVER_DIR,
} from './constants';

export function updateProjectConfigForApplicationBuilder(
  tree: Tree,
  options: Schema
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
    }
  }

  buildTarget.options ??= {};
  buildTarget.options.outputPath = outputPath;
  buildTarget.options.server = joinPathFragments(
    project.sourceRoot ?? joinPathFragments(project.root, 'src'),
    options.main
  );
  buildTarget.options.prerender = true;
  buildTarget.options.ssr = {
    entry: joinPathFragments(project.root, options.serverFileName),
  };

  updateProjectConfiguration(tree, options.project, project);
}

export function updateProjectConfigForBrowserBuilder(
  tree: Tree,
  schema: Schema
) {
  const projectConfig = readProjectConfiguration(tree, schema.project);
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

  projectConfig.targets.server = {
    dependsOn: ['build'],
    executor: buildTarget.executor.startsWith('@angular-devkit/build-angular:')
      ? '@angular-devkit/build-angular:server'
      : '@nx/angular:webpack-server',
    options: {
      outputPath: joinPathFragments(baseOutputPath, 'server'),
      main: joinPathFragments(projectConfig.root, schema.serverFileName),
      tsConfig: joinPathFragments(projectConfig.root, 'tsconfig.server.json'),
      ...(buildTarget.options ? getServerOptions(buildTarget.options) : {}),
    },
    configurations,
    defaultConfiguration: 'production',
  };

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  projectConfig.targets['serve-ssr'] = {
    executor:
      angularMajorVersion >= 17
        ? '@angular-devkit/build-angular:ssr-dev-server'
        : '@nguniversal/builders:ssr-dev-server',
    configurations: {
      development: {
        browserTarget: `${schema.project}:build:development`,
        serverTarget: `${schema.project}:server:development`,
      },
      production: {
        browserTarget: `${schema.project}:build:production`,
        serverTarget: `${schema.project}:server:production`,
      },
    },
    defaultConfiguration: 'development',
  };

  projectConfig.targets.prerender = {
    executor:
      angularMajorVersion >= 17
        ? '@angular-devkit/build-angular:prerender'
        : '@nguniversal/builders:prerender',
    options: {
      routes: ['/'],
    },
    configurations: {
      development: {
        browserTarget: `${schema.project}:build:development`,
        serverTarget: `${schema.project}:server:development`,
      },
      production: {
        browserTarget: `${schema.project}:build:production`,
        serverTarget: `${schema.project}:server:production`,
      },
    },
    defaultConfiguration: 'production',
  };

  updateProjectConfiguration(tree, schema.project, projectConfig);

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
