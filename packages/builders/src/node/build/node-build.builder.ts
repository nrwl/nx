import {
  Builder,
  BuildEvent,
  BuilderConfiguration,
  BuilderContext
} from '@angular-devkit/architect';
import { getSystemPath, normalize, Path } from '@angular-devkit/core';
import { WebpackBuilder } from '@angular-devkit/build-webpack';

import { Observable } from 'rxjs';
import { writeFileSync, statSync } from 'fs';
import { getWebpackConfig, OUT_FILENAME } from './webpack/config';
import { resolve, basename, dirname, relative } from 'path';
import { map } from 'rxjs/operators';
import {
  AssetPattern,
  AssetPatternObject
} from '@angular-devkit/build-angular';

export interface BuildNodeBuilderOptions {
  main: string;
  outputPath: string;
  tsConfig: string;
  devtool?: string | boolean;
  watch?: boolean;
  optimization?: boolean;
  externalDependencies: 'all' | 'none' | string[];
  showCircularDependencies?: boolean;
  maxWorkers?: number;

  fileReplacements: FileReplacement[];
  assets?: AssetPattern[];

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
    const options = this.normalizeOptions(
      builderConfig.options,
      builderConfig.sourceRoot
    );

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

  private normalizeOptions(options: BuildNodeBuilderOptions, sourceRoot: Path) {
    return {
      ...options,
      root: this.root,
      main: resolve(this.root, options.main),
      outputPath: resolve(this.root, options.outputPath),
      tsConfig: resolve(this.root, options.tsConfig),
      fileReplacements: this.normalizeFileReplacements(
        options.fileReplacements
      ),
      assets: this.normalizeAssets(options.assets, sourceRoot)
    };
  }

  private normalizeAssets(
    assets: AssetPattern[],
    sourceRoot: Path
  ): AssetPatternObject[] {
    return assets.map(asset => {
      if (typeof asset === 'string') {
        const assetPath = normalize(asset);
        const resolvedAssetPath = resolve(this.root, assetPath);
        const resolvedSourceRoot = resolve(this.root, sourceRoot);

        if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
          throw new Error(
            `The ${resolvedAssetPath} asset path must start with the project source root: ${sourceRoot}`
          );
        }

        const isDirectory = statSync(resolvedAssetPath).isDirectory();
        const input = isDirectory
          ? resolvedAssetPath
          : dirname(resolvedAssetPath);
        const output = relative(resolvedSourceRoot, resolve(this.root, input));
        const glob = isDirectory ? '**/*' : basename(resolvedAssetPath);
        return {
          input,
          output,
          glob
        };
      } else {
        if (asset.output.startsWith('..')) {
          throw new Error(
            'An asset cannot be written to a location outside of the output path.'
          );
        }
        return {
          ...asset,
          // Now we remove starting slash to make Webpack place it from the output root.
          output: asset.output.replace(/^\//, '')
        };
      }
    });
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
