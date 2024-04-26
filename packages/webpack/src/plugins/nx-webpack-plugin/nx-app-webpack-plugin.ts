import { Compiler } from 'webpack';
import {
  NormalizedNxAppWebpackPluginOptions,
  NxAppWebpackPluginOptions,
} from './nx-app-webpack-plugin-options';
import { normalizeOptions } from './lib/normalize-options';
import { deleteOutputDir } from '../../utils/fs';
import { applyBaseConfig } from './lib/apply-base-config';
import { applyWebConfig } from './lib/apply-web-config';

/**
 * This plugin provides features to build Node and Web applications.
 * - TS support (including tsconfig paths)
 * - Different compiler options
 * - Assets handling
 * - Stylesheets handling
 * - index.html and package.json generation
 *
 * Web-only features, such as stylesheets and images, are only supported when `target` is 'web' or 'webworker'.
 */
export class NxAppWebpackPlugin {
  private readonly options: NormalizedNxAppWebpackPluginOptions;

  constructor(options: NxAppWebpackPluginOptions = {}) {
    // If we're building inferred targets, skip normalizing build options.
    if (!global.NX_GRAPH_CREATION) {
      this.options = normalizeOptions(options);
    }
  }

  apply(compiler: Compiler): void {
    // Defaults to 'web' if not specified to match Webpack's default.
    const target = this.options.target ?? compiler.options.target ?? 'web';
    this.options.outputPath ??= compiler.options.output?.path;
    if (typeof target === 'string') {
      this.options.target = target;
    }

    applyBaseConfig(this.options, compiler.options, {
      useNormalizedEntry: true,
    });

    if (compiler.options.target) {
      this.options.target = compiler.options.target;
    }

    if (this.options.target === 'web' || this.options.target === 'webworker') {
      applyWebConfig(this.options, compiler.options, {
        useNormalizedEntry: true,
      });
    }

    if (this.options.deleteOutputPath) {
      deleteOutputDir(this.options.root, this.options.outputPath);
    }
  }
}
