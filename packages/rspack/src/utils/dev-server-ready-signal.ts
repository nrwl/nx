import type { AddressInfo } from 'net';
import type { Compiler } from '@rspack/core';

// Set on the plugins that report readiness, so inference can find them in a
// config it has loaded
export const READY_SIGNAL_PLUGIN = Symbol.for('@nx/ready-signal-plugin');

/** Whether the dev server of this config will report its readiness. */
export function sendsReadySignal(config: {
  devServer?: unknown;
  plugins?: unknown[];
}): boolean {
  return (
    typeof config.devServer === 'object' &&
    !!config.devServer &&
    !!config.plugins?.some((plugin) => plugin?.[READY_SIGNAL_PLUGIN])
  );
}

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

/** Reports the dev server's address to an Nx task whose readyWhen is `signal`. */
export class NxReadySignalPlugin {
  readonly [READY_SIGNAL_PLUGIN] = true;

  apply(compiler: Compiler): void {
    applyDevServerReadySignal(compiler);
  }
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
