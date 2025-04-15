import type { Compiler } from '@rspack/core';
import type {
  NormalizedNxAppRspackPluginOptions,
  NxAppRspackPluginOptions,
} from '../utils/models';
import { normalizeOptions } from '../utils/plugins/normalize-options';
import { applyBaseConfig } from '../utils/apply-base-config';
import { applyWebConfig } from '../utils/apply-web-config';

/**
 * This plugin provides features to build Node and Web applications.
 * - TS Support (including tsconfig paths
 * - Assets handling
 * - Stylesheets handling
 * - index.html and package.json generation
 *
 * Web-only features, such as stylesheets and images, are only supported when `target` is `web` or `webworker`.
 */
export class NxAppRspackPlugin {
  private readonly options: NormalizedNxAppRspackPluginOptions;

  constructor(options: NxAppRspackPluginOptions = {}) {
    // If we're building inferred targets, skip normalizing the build options
    if (!global.NX_GRAPH_CREATION) {
      this.options = normalizeOptions(options);
    }
  }

  apply(compiler: Compiler) {
    // Default's to web
    const target = this.options.target ?? compiler.options.target;
    this.options.outputPath ??= compiler.options.output?.path;
    if (typeof target === 'string') {
      this.options.target = target;
    }

    if (
      compiler.options.entry &&
      compiler.options.entry['main'] &&
      typeof compiler.options.entry['main'] === 'object' &&
      Object.keys(compiler.options.entry['main']).length === 0
    ) {
      compiler.options.entry = {};
    }

    // Prefer `clean` option from Rspack config over our own.
    if (typeof compiler.options.output.clean !== 'undefined') {
      this.options.deleteOutputPath = false;
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
}
