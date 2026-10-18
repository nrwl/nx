import { createConnection } from 'net';
import { resolve } from 'path';

export interface RsbuildFlags {
  port?: string;
  host?: string | true;
  envMode?: string;
}

/**
 * The flags `rsbuild dev` and `rsbuild preview` take from the target's
 * options: named options are forwarded as flags, and `args` holds the rest.
 */
export function parseRsbuildFlags(
  options: Record<string, unknown>
): RsbuildFlags {
  const flags: RsbuildFlags = {};
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
    else if (name === 'env-mode') flags.envMode = value;
  }
  for (const key of ['port', 'host', 'envMode'] as const) {
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

// https://rsbuild.rs/config/server/port
const DEFAULT_PORT = 3000;

export function getRsbuildServerAddress(
  server: { port?: unknown; host?: unknown } | undefined,
  flags: RsbuildFlags
): ServerAddress | null {
  const port = Number(flags.port ?? server?.port ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0) return null;
  const host = flags.host ?? server?.host;
  return typeof host === 'string' &&
    !['localhost', '0.0.0.0', '::'].includes(host)
    ? { port, host }
    : { port };
}

/**
 * The fallback readyWhen of the inferred dev and preview targets. Runs in
 * the env and with the options of the task, loads the config the way the
 * Rsbuild CLI does, and waits for the server's port.
 */
export async function waitForRsbuildServer(
  configPath: string,
  command: 'dev' | 'preview'
) {
  let options: Record<string, unknown> & { cwd?: string } = {};
  try {
    options = JSON.parse(process.env.NX_TASK_OPTIONS ?? '{}');
  } catch {}
  const flags = parseRsbuildFlags(options);
  const root = resolve(options.cwd ?? '.');
  // The config's file name, in the cwd of the task
  const path = resolve(root, configPath);
  process.chdir(root);

  const { loadConfig, loadEnv } =
    require('@rsbuild/core') as typeof import('@rsbuild/core');
  // The CLI sets NODE_ENV first, then loads the env files for that mode and
  // the config, whose function form reads the command from argv
  process.env.NODE_ENV ||= command === 'dev' ? 'development' : 'production';
  loadEnv({ cwd: root, mode: flags.envMode });
  process.argv[2] = command;
  const { content } = await loadConfig({
    cwd: root,
    path,
    envMode: flags.envMode,
  });

  const address = getRsbuildServerAddress(content.server, flags);
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
