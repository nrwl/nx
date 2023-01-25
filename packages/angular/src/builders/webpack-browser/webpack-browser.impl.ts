import { joinPathFragments } from '@nrwl/devkit';
import { existsSync } from 'fs';
import { from, Observable } from 'rxjs';
import {
  mergeCustomWebpackConfig,
  resolveIndexHtmlTransformer,
} from '../utilities/webpack';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { switchMap } from 'rxjs/operators';

export type BrowserBuilderSchema =
  import('@angular-devkit/build-angular/src/builders/browser/schema').Schema & {
    customWebpackConfig?: {
      path: string;
    };
    indexFileTransformer?: string;
    buildLibsFromSource?: boolean;
  };

function buildApp(
  options: BrowserBuilderSchema,
  context: import('@angular-devkit/architect').BuilderContext
): Observable<import('@angular-devkit/architect').BuilderOutput> {
  const {
    buildLibsFromSource,
    customWebpackConfig,
    indexFileTransformer,
    ...delegateOptions
  } = options;

  // If there is a path to an indexFileTransformer
  // check it exists and apply it to the build
  const pathToIndexFileTransformer =
    indexFileTransformer &&
    joinPathFragments(context.workspaceRoot, indexFileTransformer);
  if (pathToIndexFileTransformer && !existsSync(pathToIndexFileTransformer)) {
    throw new Error(
      `File containing Index File Transformer function Not Found!\n Please ensure the path to the file containing the function is correct: \n${pathToIndexFileTransformer}`
    );
  }

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
        pathToWebpackConfig,
        pathToIndexFileTransformer
      );
    } else {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  return from(import('@angular-devkit/build-angular')).pipe(
    switchMap(({ executeBrowserBuilder }) =>
      executeBrowserBuilder(delegateOptions, context, {
        ...(pathToIndexFileTransformer
          ? {
              indexHtml: resolveIndexHtmlTransformer(
                pathToIndexFileTransformer,
                options.tsConfig,
                context.target
              ),
            }
          : {}),
      })
    )
  );
}

function buildAppWithCustomWebpackConfiguration(
  options: import('@angular-devkit/build-angular/src/builders/browser/schema').Schema,
  context: import('@angular-devkit/architect').BuilderContext,
  pathToWebpackConfig: string,
  pathToIndexFileTransformer?: string
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
        ...(pathToIndexFileTransformer
          ? {
              indexHtml: resolveIndexHtmlTransformer(
                pathToIndexFileTransformer,
                options.tsConfig,
                context.target
              ),
            }
          : {}),
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
