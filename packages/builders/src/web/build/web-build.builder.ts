import {
  Builder,
  BuildEvent,
  BuilderConfiguration,
  BuilderContext
} from '@angular-devkit/architect';
import { getSystemPath } from '@angular-devkit/core';
import { WebpackBuilder } from '@angular-devkit/build-webpack';

import { Observable } from 'rxjs';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { normalizeWebBuildOptions } from '../../utils/normalize';
import { BuildBuilderOptions } from '../../utils/types';
import { getWebConfig } from '../../utils/webpack/web.config';
import {
  OutputHashing,
  StylePreprocessorOptions,
  Budget
} from '@angular-devkit/build-angular';

export interface WebBuildBuilderOptions extends BuildBuilderOptions {
  index: string;
  budgets: Budget[];
  baseHref: string;
  deployUrl: string;

  polyfills?: string;
  es2015Polyfills?: string;

  scripts: string[];
  styles: string[];

  vendorChunk?: boolean;
  commonChunk?: boolean;

  outputHashing?: OutputHashing;
  stylePreprocessingOptions?: StylePreprocessorOptions;
}

export default class BuildWebBuilder
  implements Builder<WebBuildBuilderOptions> {
  webpackBuilder: WebpackBuilder;

  root: string;

  constructor(private context: BuilderContext) {
    this.webpackBuilder = new WebpackBuilder(this.context);
    this.root = getSystemPath(this.context.workspace.root);
  }

  run(
    builderConfig: BuilderConfiguration<WebBuildBuilderOptions>
  ): Observable<BuildEvent> {
    const options = normalizeWebBuildOptions(
      builderConfig.options,
      this.root,
      builderConfig.sourceRoot
    );

    let config = getWebConfig(options, this.context.logger);
    if (options.webpackConfig) {
      config = require(options.webpackConfig)(config, {
        options,
        configuration: this.context.targetSpecifier.configuration
      });
    }
    return this.webpackBuilder.runWebpack(config, stats => {
      if (options.statsJson) {
        writeFileSync(
          resolve(this.root, options.outputPath, 'stats.json'),
          JSON.stringify(stats.toJson(), null, 2)
        );
      }

      this.context.logger.info(stats.toString());
    });
  }
}
