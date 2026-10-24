import type { RsbuildPlugin } from '@rsbuild/core';
import { isIPv6 } from 'net';

/**
 * Reports the dev or preview server's address to an Nx task whose readyWhen
 * is `signal`, once the server listens. Does nothing outside such a task.
 */
export function pluginNxReadySignal(): RsbuildPlugin {
  return {
    name: 'nx:ready-signal',
    setup(api) {
      if (!process.env.NX_READY_SIGNAL_SOCKET) {
        return;
      }
      const { emitReadySignal } =
        require('@nx/devkit') as typeof import('@nx/devkit');
      const report = ({ port }: { port: number }) => {
        const { https, host } = api.getNormalizedConfig().server;
        emitReadySignal(
          `${https ? 'https' : 'http'}://${getUrlHost(host)}:${port}/`
        );
      };
      api.onAfterStartDevServer(report);
      // Rsbuild 1 names the preview hook onAfterStartProdServer
      const onAfterStartPreviewServer =
        api.onAfterStartPreviewServer ??
        (
          api as typeof api & {
            onAfterStartProdServer: typeof api.onAfterStartPreviewServer;
          }
        ).onAfterStartProdServer;
      onAfterStartPreviewServer(report);
    },
  };
}

function getUrlHost(host: string | undefined): string {
  if (!host || host === '0.0.0.0' || host === '::') {
    return 'localhost';
  }
  return isIPv6(host) ? `[${host}]` : host;
}
