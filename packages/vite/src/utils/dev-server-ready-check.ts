import { createConnection } from 'net';
import { resolve } from 'path';
import { loadViteDynamicImport } from './executor-utils';

export interface ViteFlags {
  port?: string;
  host?: string | true;
  mode?: string;
}

/**
 * The flags `vite` and `vite preview` take from the target's options: named
 * options are forwarded as flags, and `args` holds the rest.
 */
export function parseViteFlags(options: Record<string, unknown>): ViteFlags {
  const flags: ViteFlags = {};
  const args = Array.isArray(options.args)
    ? options.args.map(String)
    : typeof options.args === 'string'
      ? options.args.split(/\s+/).filter(Boolean)
      : [];
  for (let i = 0; i < args.length; i++) {
    const [, name, inline] = args[i].match(/^--([^=]+)(?:=(.*))?$/) ?? [];
    if (!name) continue;
    let value = inline;
    if (value === undefined && args[i + 1] && !args[i + 1].startsWith('-')) {
      value = args[++i];
    }
    if (name === 'port') flags.port = value;
    else if (name === 'host') flags.host = value ?? true;
    else if (name === 'mode' || name === 'm') flags.mode = value;
  }
  for (const key of ['port', 'host', 'mode'] as const) {
    const value = options[key];
    if (typeof value === 'string' || typeof value === 'number') {
      flags[key] = String(value);
    } else if (key === 'host' && value === true) {
      flags.host = true;
    }
  }
  return flags;
}

export type ServerAddress = { port: number; host?: string };

// Vite's default ports: https://vite.dev/config/server-options#server-port
const DEFAULT_PORT = { serve: 5173, preview: 4173 };

export function getViteServerAddress(
  server: { port?: unknown; host?: unknown } | undefined,
  flags: ViteFlags,
  command: 'serve' | 'preview'
): ServerAddress | null {
  const port = Number(flags.port ?? server?.port ?? DEFAULT_PORT[command]);
  if (!Number.isInteger(port) || port <= 0) return null;
  const host = flags.host ?? server?.host;
  // `true` and the wildcards listen on every address, loopback included
  return typeof host === 'string' &&
    !['localhost', '0.0.0.0', '::'].includes(host)
    ? { port, host }
    : { port };
}

/**
 * The fallback readyWhen of the inferred serve and preview targets. Runs in
 * the env and with the options of the task, resolves the config the way
 * `vite` does, and waits for the server's port.
 */
export async function waitForViteServer(
  configPath: string,
  command: 'serve' | 'preview'
) {
  let options: Record<string, unknown> & { cwd?: string } = {};
  try {
    options = JSON.parse(process.env.NX_TASK_OPTIONS ?? '{}');
  } catch {}
  const flags = parseViteFlags(options);
  const root = resolve(options.cwd ?? '.');
  const configFile = resolve(configPath);
  process.chdir(root);

  const { resolveConfig } = await loadViteDynamicImport();
  const mode =
    flags.mode ?? (command === 'preview' ? 'production' : 'development');
  const config = await resolveConfig(
    { configFile, root, mode },
    'serve',
    mode,
    mode === 'production' ? 'production' : 'development',
    command === 'preview'
  );
  const address = getViteServerAddress(
    command === 'preview'
      ? { ...config.preview, host: config.preview.host ?? config.server.host }
      : config.server,
    flags,
    command
  );
  if (address) await waitForAddress(address);
}

async function waitForAddress({ port, host }: ServerAddress) {
  const hosts = host ? [host] : ['127.0.0.1', '::1'];
  while (
    !(await Promise.any(hosts.map((h) => connects(port, h))).catch(() => false))
  ) {
    await new Promise((r) => setTimeout(r, 250));
  }
}

function connects(port: number, host: string): Promise<true> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', (e) => {
      socket.destroy();
      reject(e);
    });
  });
}
