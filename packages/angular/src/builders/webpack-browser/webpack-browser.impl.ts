import { joinPathFragments } from '@nrwl/devkit';
import { existsSync } from 'fs';
import { from, Observable } from 'rxjs';
import { mergeCustomWebpackConfig } from '../utilities/webpack';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { switchMap } from 'rxjs/operators';

export type BrowserBuilderSchema =
  import('@angular-devkit/build-angular/src/builders/browser/schema').Schema & {
    customWebpackConfig?: {
      path: string;
    };
    buildLibsFromSource?: boolean;
  };

function buildApp(
  options: BrowserBuilderSchema,
  context: import('@angular-devkit/architect').BuilderContext
): Observable<import('@angular-devkit/architect').BuilderOutput> {
  const { buildLibsFromSource, customWebpackConfig, ...delegateOptions } =
    options;
  // If there is a path to custom webpack config
  // Invoke our own support for custom webpack config
  if (customWebpackConfig && customWebpackConfig.path) {
    const pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      customWebpackConfig.path
    );

    if (existsSync(pathToWebpackConfig)) {
      return buildAppWithCustomWebpackConfiguration(
        delegateOptions,
        context,
        pathToWebpackConfig
      );
    } else {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  return from(import('@angular-devkit/build-angular')).pipe(
    switchMap(({ executeBrowserBuilder }) =>
      executeBrowserBuilder(delegateOptions, context)
    )
  );
}

function buildAppWithCustomWebpackConfiguration(
  options: import('@angular-devkit/build-angular/src/builders/browser/schema').Schema,
  context: import('@angular-devkit/architect').BuilderContext,
  pathToWebpackConfig: string
) {
  return from(import('@angular-devkit/build-angular')).pipe(
    switchMap(({ executeBrowserBuilder }) =>
      executeBrowserBuilder(options, context as any, {
        webpackConfiguration: (baseWebpackConfig) =>
          mergeCustomWebpackConfig(
            baseWebpackConfig,
            pathToWebpackConfig,
            options,
            context.target
          ),
      })
    )
  );
}

export function executeWebpackBrowserBuilder(
  options: BrowserBuilderSchema,
  context: import('@angular-devkit/architect').BuilderContext
): Observable<import('@angular-devkit/architect').BuilderOutput> {
  options.buildLibsFromSource ??= true;

  if (!options.buildLibsFromSource) {
    const { tsConfigPath } = createTmpTsConfigForBuildableLibs(
      options.tsConfig,
      context
    );
    options.tsConfig = tsConfigPath;
  }

  return buildApp(options, context);
}

export default require('@angular-devkit/architect').createBuilder(
  executeWebpackBrowserBuilder
) as any;
