import { Compiler } from 'webpack';
import {
  NormalizedNxWebpackPluginOptions,
  NxWebpackPluginOptions,
} from './nx-webpack-plugin-options';
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
export class NxWebpackPlugin {
  private readonly options: NormalizedNxWebpackPluginOptions;

  constructor(options: NxWebpackPluginOptions) {
    this.options = normalizeOptions({
      ...options,
      ...this.readExecutorOptions(),
    });
  }

  apply(compiler: Compiler): void {
    const target = this.options.target ?? compiler.options.target;
    this.options.outputPath ??= compiler.options.output?.path;
    if (typeof target === 'string') {
      this.options.target = target;
    }

    if (this.options.deleteOutputPath) {
      deleteOutputDir(this.options.root, this.options.outputPath);
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
  }

  private readExecutorOptions() {
    const fromExecutor = process.env['NX_WEBPACK_EXECUTOR_RAW_OPTIONS'] ?? '{}';
    try {
      return JSON.parse(fromExecutor);
    } catch {
      return {};
    }
  }
}
