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
import { OUT_FILENAME } from '../../utils/webpack/config';
import { resolve } from 'path';
import { map } from 'rxjs/operators';
import { getNodeWebpackConfig } from '../../utils/webpack/node.config';
import { normalizeBuildOptions } from '../../utils/normalize';
import { BuildBuilderOptions } from '../../utils/types';

try {
  require('dotenv').config();
} catch (e) {}

export interface BuildNodeBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  externalDependencies: 'all' | 'none' | string[];
}

export interface NodeBuildEvent extends BuildEvent {
  outfile: string;
}

export default class BuildNodeBuilder
  implements Builder<BuildNodeBuilderOptions> {
  webpackBuilder: WebpackBuilder;

  root: string;

  constructor(private context: BuilderContext) {
    this.webpackBuilder = new WebpackBuilder(this.context);
    this.root = getSystemPath(this.context.workspace.root);
  }

  run(
    builderConfig: BuilderConfiguration<BuildNodeBuilderOptions>
  ): Observable<NodeBuildEvent> {
    const options = normalizeBuildOptions(
      builderConfig.options,
      this.root,
      builderConfig.sourceRoot
    );

    let config = getNodeWebpackConfig(options);
    if (options.webpackConfig) {
      config = require(options.webpackConfig)(config, {
        options,
        configuration: this.context.targetSpecifier.configuration
      });
    }
    return this.webpackBuilder
      .runWebpack(config, stats => {
        if (options.statsJson) {
          writeFileSync(
            resolve(this.root, options.outputPath, 'stats.json'),
            JSON.stringify(stats.toJson(), null, 2)
          );
        }

        this.context.logger.info(stats.toString());
      })
      .pipe(
        map(buildEvent => ({
          ...buildEvent,
          outfile: resolve(this.root, options.outputPath, OUT_FILENAME)
        }))
      );
  }
}
