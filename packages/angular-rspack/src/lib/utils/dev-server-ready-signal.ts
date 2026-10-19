import { emitReadySignal } from '@nx/devkit';
import { getListeningUrl } from '@nx/devkit/internal';
import type { Compiler } from '@rspack/core';

// @nx/rspack/plugin infers a signal readyWhen for a dev server config with a
// plugin that carries this
export const READY_SIGNAL_PLUGIN = Symbol.for('@nx/ready-signal-plugin');

/**
 * Reports the dev server's address to an Nx task whose readyWhen is `signal`.
 * `rspack serve` reads `devServer` from the compiler after plugins apply,
 * so wrapping `onListening` here reaches the server it starts.
 */
export function applyDevServerReadySignal(compiler: Compiler): void {
  const devServer = compiler.options.devServer;
  if (!devServer || !process.env.NX_READY_SIGNAL_SOCKET) {
    return;
  }
  const onListening = devServer.onListening;
  devServer.onListening = (server) => {
    onListening?.(server);
    // The dev server has normalized `options.server` to `{ type, options }`
    emitReadySignal(
      getListeningUrl(
        server.server?.address(),
        server.options.server.type !== 'http'
      )
    );
  };
}
