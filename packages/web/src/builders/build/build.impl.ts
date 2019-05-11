import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import {
  JsonObject,
  normalize,
  join as devkitJoin
} from '@angular-devkit/core';
import { runWebpack, BuildResult } from '@angular-devkit/build-webpack';

import { Observable, from, of, forkJoin } from 'rxjs';
import { normalizeWebBuildOptions } from '../../utils/normalize';
import { getWebConfig } from '../../utils/web.config';
import { BuildBuilderOptions } from '../../utils/types';
import {
  bufferCount,
  concatMap,
  map,
  mergeScan,
  switchMap
} from 'rxjs/operators';
import { getSourceRoot } from '../../utils/source-root';
import { ScriptTarget } from 'typescript';
import { writeIndexHtml } from '@angular-devkit/build-angular/src/angular-cli-files/utilities/index-file/write-index-html';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

export interface WebBuildBuilderOptions extends BuildBuilderOptions {
  differentialLoading: boolean;
  index: string;
  budgets: any[];
  baseHref: string;
  deployUrl: string;

  polyfills?: string;
  es2015Polyfills?: string;

  scripts: string[];
  styles: string[];

  vendorChunk?: boolean;
  commonChunk?: boolean;

  outputHashing?: any;
  stylePreprocessingOptions?: any;
}

export default createBuilder<WebBuildBuilderOptions & JsonObject>(run);

export function run(
  options: WebBuildBuilderOptions,
  context: BuilderContext
): Observable<BuildResult> {
  const host = new NodeJsSyncHost();
  return from(getSourceRoot(context, host)).pipe(
    map(sourceRoot => {
      options = normalizeWebBuildOptions(
        options,
        context.workspaceRoot,
        sourceRoot
      );
      let configs = [
        getWebConfig(
          context.workspaceRoot,
          sourceRoot,
          options,
          context.logger,
          options.differentialLoading ? ScriptTarget.ES2015 : null
        )
      ];
      if (options.differentialLoading) {
        configs.push(
          getWebConfig(
            context.workspaceRoot,
            sourceRoot,
            options,
            context.logger,
            ScriptTarget.ES5
          )
        );
      }
      if (options.webpackConfig) {
        configs = configs.map(config =>
          require(options.webpackConfig)(config, {
            options,
            configuration: context.target.configuration
          })
        );
      }
      return configs;
    }),
    concatMap(configs => {
      const runWebpackOptions = {
        logging: stats => {
          context.logger.info(stats.toString());
        }
      };
      return forkJoin(
        configs.map(config => runWebpack(config, context, runWebpackOptions))
      ).pipe(
        switchMap(
          ([result1, result2 = { success: true, emittedFiles: [] }]) => {
            const success = [result1, result2].every(result => result.success);

            return (options.differentialLoading
              ? writeIndexHtml({
                  host,
                  outputPath: normalize(options.outputPath),
                  indexPath: devkitJoin(
                    normalize(context.workspaceRoot),
                    options.index
                  ),
                  ES5BuildFiles: result2.emittedFiles,
                  ES2015BuildFiles: result1.emittedFiles,
                  baseHref: options.baseHref,
                  deployUrl: options.deployUrl,
                  scripts: options.scripts,
                  styles: options.styles
                })
              : of(null)
            ).pipe(
              map(
                () =>
                  ({
                    success,
                    emittedFiles: [
                      ...result1.emittedFiles,
                      ...result2.emittedFiles
                    ]
                  } as BuildResult)
              )
            );
          }
        )
      );
    })
  );
}
