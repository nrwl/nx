import type { AddressInfo } from 'net';
import type { Compiler } from '@rspack/core';

/**
 * Reports the dev server's address to an Nx task whose readyWhen is `signal`.
 * `rspack serve` reads `devServer` from the compiler after plugins apply,
 * so wrapping `onListening` here reaches the server it starts.
 */
export function applyDevServerReadySignal(compiler: Compiler): void {
  const devServer = compiler.options.devServer as
    | { onListening?: (server: any) => void }
    | false
    | undefined;
  if (!devServer || !process.env.NX_READY_SIGNAL_SOCKET) {
    return;
  }
  const { announceTaskReadySignal, signalTaskReady } =
    require('@nx/devkit') as typeof import('@nx/devkit');
  if (!announceTaskReadySignal()) {
    return;
  }
  const onListening = devServer.onListening;
  devServer.onListening = (server) => {
    onListening?.(server);
    signalTaskReady({ url: getDevServerUrl(server) });
  };
}

export function getDevServerUrl(server: {
  server?: { address(): AddressInfo | string | null };
  options?: { server?: string | { type?: string } };
}): string | undefined {
  const address = server.server?.address();
  if (!address || typeof address === 'string') {
    return undefined;
  }
  const type =
    typeof server.options?.server === 'string'
      ? server.options.server
      : server.options?.server?.type;
  const protocol = type && type !== 'http' ? 'https' : 'http';
  const host =
    address.address === '::' || address.address === '0.0.0.0'
      ? 'localhost'
      : address.family === 'IPv6'
        ? `[${address.address}]`
        : address.address;
  return `${protocol}://${host}:${address.port}/`;
}
