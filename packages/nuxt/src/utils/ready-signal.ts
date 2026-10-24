import type { AddressInfo } from 'net';
import { waitUntilServing } from './wait-until-serving';

// Set on the module so inference can find it in a config it has loaded
const READY_SIGNAL_MODULE = Symbol.for('@nx/ready-signal-plugin');

interface Server {
  address(): AddressInfo | string | null;
}

interface Listener {
  url?: string;
  https?: unknown;
}

interface NuxtWithHooks {
  hook(
    name: 'listen',
    fn: (server: Server, listener: Listener) => void
  ): unknown;
  hook(name: 'build:done', fn: () => void): unknown;
}

/**
 * Nuxt module that reports the `nuxt dev` server's URL to an Nx task whose
 * readyWhen is `signal`, once it has built and serves the app. Does nothing
 * outside such a task.
 */
export function nxReadySignal(_options: unknown, nuxt: NuxtWithHooks) {
  if (!process.env.NX_READY_SIGNAL_SOCKET) {
    return;
  }
  const { emitReadySignal } =
    require('@nx/devkit') as typeof import('@nx/devkit');
  const { getListeningUrl } =
    require('@nx/devkit/internal') as typeof import('@nx/devkit/internal');
  nuxt.hook('listen', (server, listener) => {
    // Added after setup, this runs after the build:done hooks setup added,
    // such as Nitro's wait to compile
    nuxt.hook('build:done', () => {
      const url =
        getCliUrl(listener) ??
        getListeningUrl(server.address(), !!listener.https);
      if (!url) {
        // A server on a socket can't be probed
        emitReadySignal();
        return;
      }
      // nuxi 3.7.0 to 3.7.2 pass `{}` from a forked child, whose server is
      // internal, so its address isn't the one to report
      const internal = Object.keys(listener).length === 0;
      // The CLI serves the app only after this hook returns: until then it
      // answers 503 or holds the request, so the hook must not wait for it
      void waitUntilServing([url]).then(() =>
        internal ? emitReadySignal() : emitReadySignal(url)
      );
    });
  });
}
nxReadySignal[READY_SIGNAL_MODULE] = true;

// The URL the CLI serves on, which is its proxy's when Nuxt runs behind one.
// A wildcard host maps to localhost, as `getListeningUrl` maps it.
function getCliUrl({ url }: Listener): string | undefined {
  if (!url || !URL.canParse(url)) {
    return undefined;
  }
  const parsed = new URL(url);
  if (parsed.hostname === '0.0.0.0' || parsed.hostname === '[::]') {
    parsed.hostname = 'localhost';
  }
  return parsed.href;
}

/** Whether a Nuxt config's `modules` load {@link nxReadySignal}. */
export function loadsReadySignalModule(modules: unknown): boolean {
  return (
    Array.isArray(modules) &&
    modules.some((entry) => {
      const module = Array.isArray(entry) ? entry[0] : entry;
      return (
        module === '@nx/nuxt/ready-signal' || !!module?.[READY_SIGNAL_MODULE]
      );
    })
  );
}
