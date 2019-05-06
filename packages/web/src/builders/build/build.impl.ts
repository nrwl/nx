import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject, workspaces } from '@angular-devkit/core';
import { runWebpack, BuildResult } from '@angular-devkit/build-webpack';

import { Observable, from } from 'rxjs';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { normalizeWebBuildOptions } from '../../utils/normalize';
import { getWebConfig } from '../../utils/web.config';
import { BuildBuilderOptions } from '../../utils/types';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { concatMap, map } from 'rxjs/operators';
import { getSourceRoot } from '../../utils/source-root';

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

  outputHashing?: any;
  stylePreprocessingOptions?: any;
}

export default createBuilder<WebBuildBuilderOptions & JsonObject>(run);

export function run(
  options: WebBuildBuilderOptions,
  context: BuilderContext
): Observable<BuildResult> {
  return from(getSourceRoot(context)).pipe(
    map(sourceRoot => {
      options = normalizeWebBuildOptions(
        options,
        context.workspaceRoot,
        sourceRoot
      );
      let config = getWebConfig(
        context.workspaceRoot,
        sourceRoot,
        options,
        context.logger
      );
      if (options.webpackConfig) {
        config = require(options.webpackConfig)(config, {
          options,
          configuration: context.target.configuration
        });
      }
      return config;
    }),
    concatMap(config =>
      runWebpack(config, context, {
        logging: stats => {
          if (options.statsJson) {
            writeFileSync(
              resolve(context.workspaceRoot, options.outputPath, 'stats.json'),
              JSON.stringify(stats.toJson(), null, 2)
            );
          }

          context.logger.info(stats.toString());
        }
      })
    )
  );
}
