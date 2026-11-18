import type { FileReplacement } from '@nx/angular-rspack-compiler';
import { emitReadySignal } from '@nx/devkit';
import { getListeningUrl } from '@nx/devkit/internal';
import type { Compiler } from '@rspack/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

/**
 * Whether the SSR server entry, or the file that replaces it, mentions
 * `emitReadySignal`, taken to mean it reports readiness itself. The forked SSR
 * server, not the dev server, is then the address the waiting tasks need.
 */
export function ssrServerEmitsReadySignal(
  root: string,
  ssr: boolean | { entry?: string } | undefined,
  fileReplacements: FileReplacement[]
): boolean {
  if (typeof ssr !== 'object' || !ssr.entry) {
    return false;
  }
  const entry = resolve(root, ssr.entry);
  // The compiler applies the last replacement for a path
  const file = fileReplacements.reduce(
    (file, { replace, with: replacement }) =>
      replace === entry ? replacement : file,
    entry
  );
  try {
    return readFileSync(file, 'utf-8').includes('emitReadySignal');
  } catch {
    return false;
  }
}
