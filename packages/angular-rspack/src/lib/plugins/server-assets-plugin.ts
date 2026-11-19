import type { Compiler, RspackPluginInstance } from '@rspack/core';
import {
  CRITICAL_CSS_FILE,
  INDEX_CSR_HTML,
  INDEX_SERVER_HTML,
} from '../ssr/server-assets';
import type { SharedServerRenderingInputs } from './index-html-plugin';

const PLUGIN_NAME = 'ServerAssetsPlugin';

/**
 * Emits the files the application engine reads from the server output (see
 * `createServerAssets` and `readCriticalCss`).
 */
export class ServerAssetsPlugin implements RspackPluginInstance {
  constructor(
    private readonly serverRenderingInputs: SharedServerRenderingInputs,
    private readonly usesCriticalCssPlans: boolean
  ) {}

  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          const inputs = this.serverRenderingInputs.current;
          // The engine is only wired up without locale inlining.
          const indexHtml = inputs?.indexHtml.get('');
          if (!indexHtml) {
            return;
          }

          const { RawSource } = compiler.rspack.sources;
          compilation.emitAsset(
            INDEX_SERVER_HTML,
            new RawSource(indexHtml.server)
          );
          compilation.emitAsset(INDEX_CSR_HTML, new RawSource(indexHtml.csr));
          if (this.usesCriticalCssPlans) {
            compilation.emitAsset(
              CRITICAL_CSS_FILE,
              new RawSource(
                JSON.stringify({
                  criticalCssPlans: inputs.criticalCssPlans?.length
                    ? inputs.criticalCssPlans
                    : undefined,
                  nonce: indexHtml.nonce,
                })
              )
            );
          }
        }
      );
    });
  }
}
