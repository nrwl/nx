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
  private readonly options: NormalizedNxAppRspackPluginOptions | undefined;
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

    const { options } = this;
    if (!options) {
      throw new Error(
        'The plugin options were not normalized because the plugin was created during project graph creation.'
      );
    }

    // Default's to web
    const target = options.target ?? compiler.options.target;
    options.outputPath ??= compiler.options.output?.path;
    if (typeof target === 'string') {
      options.target = target;
    }

    const entry = compiler.options.entry;
    if (
      entry &&
      typeof entry !== 'function' &&
      entry['main'] &&
      typeof entry['main'] === 'object' &&
      Object.keys(entry['main']).length === 0
    ) {
      compiler.options.entry = {};
    }

    applyBaseConfig(options, compiler.options, {
      useNormalizedEntry: true,
      compiler,
    });
    if (compiler.options.context !== undefined) {
      compiler.context = compiler.options.context;
    }

    if (compiler.options.target) {
      options.target = compiler.options.target;
    }

    if (isBrowserTarget(compiler, options.target) || options.ssr) {
      applyWebConfig(options, compiler.options, {
        useNormalizedEntry: true,
        compiler,
      });
    }
  }
}

// Let rspack resolve the platform so `browserslist` targets count by the browsers they list.
function isBrowserTarget(
  compiler: Compiler,
  target: string | string[] | undefined
) {
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
