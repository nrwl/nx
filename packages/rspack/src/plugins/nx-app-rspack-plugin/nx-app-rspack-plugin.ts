import type { Compiler, Configuration } from '@rspack/core';
import type {
  NormalizedNxAppRspackPluginOptions,
  NxAppRspackPluginOptions,
} from '../utils/models';
import { normalizeOptions } from '../utils/plugins/normalize-options';
import { READY_SIGNAL_PLUGIN } from '../../utils/dev-server-ready-signal';
import { applyBaseConfig } from '../utils/apply-base-config';
import { applyWebConfig } from '../utils/apply-web-config';
import { loadRspackCore } from '../../utils/load-rspack-core';

/**
 * This plugin provides features to build Node and Web applications.
 * - TS Support (including tsconfig paths
 * - Assets handling
 * - Stylesheets handling
 * - index.html and package.json generation
 *
 * Web-only features, such as stylesheets and images, are only supported when `target` runs in a browser, such as `web`, `webworker` or `browserslist`.
 */
export class NxAppRspackPlugin {
  private readonly options: NormalizedNxAppRspackPluginOptions;
  readonly [READY_SIGNAL_PLUGIN] = true;

  constructor(options: NxAppRspackPluginOptions = {}) {
    // If we're building inferred targets, skip normalizing the build options
    if (!global.NX_GRAPH_CREATION) {
      this.options = normalizeOptions(options);
    }
  }

  apply(compiler: Compiler) {
    const { applyDevServerReadySignal } =
      require('../../utils/dev-server-ready-signal') as typeof import('../../utils/dev-server-ready-signal');
    applyDevServerReadySignal(compiler);

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

    applyBaseConfig(this.options, compiler.options, {
      useNormalizedEntry: true,
      compiler,
    });
    compiler.context = compiler.options.context;

    if (compiler.options.target) {
      this.options.target = compiler.options.target;
    }

    if (isBrowserTarget(compiler, this.options.target) || this.options.ssr) {
      applyWebConfig(this.options, compiler.options, {
        useNormalizedEntry: true,
        compiler,
      });
    }
  }
}

// Let rspack resolve the platform so `browserslist` targets count by the browsers they list.
function isBrowserTarget(compiler: Compiler, target: string | string[]) {
  const { config } = loadRspackCore(compiler);
  const options = config.getNormalizedRspackOptions({
    context: compiler.options.context,
    target: target as Configuration['target'],
    // Rspack throws for targets without a default chunk format, such as `es2020`.
    output: { chunkFormat: false },
  });
  // Read the applied defaults: rspack 1.6 and earlier return nothing from this call.
  config.applyRspackOptionsDefaults(options);
  return (
    options.externalsPresets.web === true &&
    options.externalsPresets.node === false
  );
}
