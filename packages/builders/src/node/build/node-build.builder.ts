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
import { getWebpackConfig, OUT_FILENAME } from './webpack/config';
import { resolve } from 'path';
import { map } from 'rxjs/operators';

export interface BuildNodeBuilderOptions {
  main: string;
  outputPath: string;
  tsConfig: string;
  watch?: boolean;
  optimization?: boolean;
  externalDependencies: 'all' | 'none' | string[];
  showCircularDependencies?: boolean;
  maxWorkers?: number;

  fileReplacements: FileReplacement[];

  progress?: boolean;
  statsJson?: boolean;
  extractLicenses?: boolean;

  root?: string;
}

export interface FileReplacement {
  replace: string;
  with: string;
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
    const options = this.normalizeOptions(builderConfig.options);

    let config = getWebpackConfig(options);
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

  private normalizeOptions(options: BuildNodeBuilderOptions) {
    return {
      ...options,
      root: this.root,
      main: resolve(this.root, options.main),
      outputPath: resolve(this.root, options.outputPath),
      tsConfig: resolve(this.root, options.tsConfig),
      fileReplacements: this.normalizeFileReplacements(options.fileReplacements)
    };
  }

  private normalizeFileReplacements(
    fileReplacements: FileReplacement[]
  ): FileReplacement[] {
    return fileReplacements.map(fileReplacement => ({
      replace: resolve(this.root, fileReplacement.replace),
      with: resolve(this.root, fileReplacement.with)
    }));
  }
}
