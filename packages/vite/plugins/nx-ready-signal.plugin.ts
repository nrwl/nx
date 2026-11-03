import type { AddressInfo } from 'net';
import type { Plugin } from 'vite';

type HttpServer = {
  once(event: 'listening', listener: () => void): unknown;
  address(): AddressInfo | string | null;
};

/**
 * Reports the dev or preview server's address to an Nx task whose readyWhen
 * is `signal`, once the server listens. Does nothing outside such a task.
 */
export function nxReadySignal(): Plugin {
  return {
    // No `apply`, so inference finds it in the config Vite resolves for a
    // build. Its hooks only run for the dev and preview servers.
    name: 'nx-ready-signal',
    configureServer(server) {
      report(server.httpServer, !!server.config.server.https);
    },
    configurePreviewServer(server) {
      report(server.httpServer, !!server.config.preview.https);
    },
  };
}

function report(httpServer: HttpServer | null, https: boolean) {
  if (!httpServer || !process.env.NX_READY_SIGNAL_SOCKET) {
    return;
  }
  const { emitReadySignal } =
    require('@nx/devkit') as typeof import('@nx/devkit');
  const { getListeningUrl } =
    require('@nx/devkit/internal') as typeof import('@nx/devkit/internal');
  httpServer.once('listening', () => {
    emitReadySignal(getListeningUrl(httpServer.address(), https));
  });
}
