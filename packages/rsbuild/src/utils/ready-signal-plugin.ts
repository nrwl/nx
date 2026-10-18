import type { RsbuildPlugin } from '@rsbuild/core';

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
      const { signalTaskReady } =
        require('@nx/devkit') as typeof import('@nx/devkit');
      const report = ({ port }: { port: number }) => {
        const https = !!api.getNormalizedConfig().server.https;
        signalTaskReady({
          url: `${https ? 'https' : 'http'}://localhost:${port}/`,
        });
      };
      api.onAfterStartDevServer(report);
      api.onAfterStartPreviewServer(report);
    },
  };
}
