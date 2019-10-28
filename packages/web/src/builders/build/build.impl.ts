import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import {
  join as devkitJoin,
  JsonObject,
  normalize
} from '@angular-devkit/core';
import { BuildResult, runWebpack } from '@angular-devkit/build-webpack';
import { from, Observable, of } from 'rxjs';
import { normalizeWebBuildOptions } from '../../utils/normalize';
import { getWebConfig } from '../../utils/web.config';
import { BuildBuilderOptions } from '../../utils/types';
import { bufferCount, map, mergeScan, switchMap } from 'rxjs/operators';
import { getSourceRoot } from '../../utils/source-root';
import { writeIndexHtml } from '../../utils/build-angular/angular-cli-files/utilities/index-file/write-index-html';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { execSync } from 'child_process';
import { Range, satisfies } from 'semver';
import { basename } from 'path';

export interface WebBuildBuilderOptions extends BuildBuilderOptions {
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

  stylePreprocessingOptions?: any;
  subresourceIntegrity?: boolean;

  verbose?: boolean;
}

export default createBuilder<WebBuildBuilderOptions & JsonObject>(run);

export function run(options: WebBuildBuilderOptions, context: BuilderContext) {
  const host = new NodeJsSyncHost();
  const isScriptOptimizeOn =
    typeof options.optimization === 'boolean'
      ? options.optimization
      : options.optimization && options.optimization.scripts
      ? options.optimization.scripts
      : false;

  // Node versions 12.2-12.8 has a bug where prod builds will hang for 2-3 minutes
  // after the program exits.
  const nodeVersion = execSync(`node --version`)
    .toString('utf-8')
    .trim();
  const supportedRange = new Range('10 || >=12.9');
  if (!satisfies(nodeVersion, supportedRange)) {
    throw new Error(
      `Node version ${nodeVersion} is not supported. Supported range is "${supportedRange.raw}".`
    );
  }
  return from(getSourceRoot(context, host))
    .pipe(
      map(sourceRoot => {
        options = normalizeWebBuildOptions(
          options,
          context.workspaceRoot,
          sourceRoot
        );
        return [
          // ESM build for modern browsers.
          getWebConfig(
            context.workspaceRoot,
            sourceRoot,
            options,
            context.logger,
            true,
            isScriptOptimizeOn
          ),
          // ES5 build for legacy browsers.
          isScriptOptimizeOn
            ? getWebConfig(
                context.workspaceRoot,
                sourceRoot,
                options,
                context.logger,
                false,
                isScriptOptimizeOn
              )
            : undefined
        ]
          .filter(Boolean)
          .map(config =>
            options.webpackConfig
              ? require(options.webpackConfig)(config, {
                  options,
                  configuration: context.target.configuration
                })
              : config
          );
      })
    )
    .pipe(
      switchMap(configs =>
        from(configs).pipe(
          // Run build sequentially and bail when first one fails.
          mergeScan(
            (acc, config) => {
              if (acc.success) {
                return runWebpack(config, context, {
                  logging: stats => {
                    context.logger.info(stats.toString(config.stats));
                  }
                });
              } else {
                return of();
              }
            },
            { success: true } as BuildResult,
            1
          ),
          // Collect build results as an array.
          bufferCount(configs.length)
        )
      ),
      switchMap(([result1, result2 = { success: true, emittedFiles: [] }]) => {
        const success = [result1, result2].every(result => result.success);
        return (options.optimization
          ? writeIndexHtml({
              host,
              outputPath: devkitJoin(
                normalize(options.outputPath),
                basename(options.index)
              ),
              indexPath: devkitJoin(
                normalize(context.workspaceRoot),
                options.index
              ),
              files: result1.emittedFiles.filter(x => x.extension === '.css'),
              noModuleFiles: result2.emittedFiles,
              moduleFiles: result1.emittedFiles,
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
                emittedFiles: [...result1.emittedFiles, ...result2.emittedFiles]
              } as BuildResult)
          )
        );
      })
    );
}
