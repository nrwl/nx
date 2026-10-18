import { resolveStartupHost } from '@nx/devkit/internal';
import { createConnection } from 'net';
import { resolve } from 'path';

export interface ServeFlags {
  port?: string;
  host?: string;
  nodeEnv?: string;
  configNames: string[];
}

/**
 * The flags `rspack serve` takes from the target's options: named options
 * are forwarded as flags, and `args` holds the rest.
 */
export function parseServeFlags(options: Record<string, unknown>): ServeFlags {
  const flags: ServeFlags = { configNames: [] };
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
    else if (name === 'host') flags.host = value;
    else if (name === 'node-env') flags.nodeEnv = value;
    else if (name === 'config-name' && value) flags.configNames.push(value);
  }
  const option = (key: string) =>
    typeof options[key] === 'string' || typeof options[key] === 'number'
      ? String(options[key])
      : undefined;
  flags.port = option('port') ?? flags.port;
  flags.host = option('host') ?? flags.host;
  const configName = option('configName') ?? option('config-name');
  if (configName) flags.configNames.push(configName);
  return flags;
}

export type DevServerAddress = { port: number; host?: string };

/**
 * Where a dev server listens, or null when it picks its port or listens on a
 * socket. Returns null for those, since nothing can be probed ahead of them.
 */
export function getDevServerAddress(
  devServer: { port?: unknown; host?: unknown; ipc?: unknown } | undefined,
  flags: ServeFlags,
  basePort: string | undefined
): DevServerAddress | null {
  if (devServer?.ipc) return null;
  const port = flags.port ?? devServer?.port ?? basePort ?? 8080;
  if (port === 'auto' || String(port) === '0') return null;
  const number = Number(port);
  if (!Number.isInteger(number) || number <= 0) return null;
  const configured = flags.host ?? devServer?.host;
  const host =
    typeof configured === 'string' ? resolveStartupHost(configured) : undefined;
  return host && !LOOPBACK_HOSTS.has(host)
    ? { port: number, host }
    : { port: number };
}

// The probe reaches these on loopback. `local-ip` and friends resolve to an
// interface address first, the way the dev server resolves them.
const LOOPBACK_HOSTS = new Set(['localhost', '0.0.0.0', '::']);

/** Resolves once every address accepts a TCP connection. */
export async function waitForAddresses(
  addresses: DevServerAddress[]
): Promise<void> {
  await Promise.all(addresses.map(waitForAddress));
}

async function waitForAddress({ port, host }: DevServerAddress) {
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

export function readTaskOptions(): Record<string, unknown> & { cwd?: string } {
  try {
    return JSON.parse(process.env.NX_TASK_OPTIONS ?? '{}');
  } catch {
    return {};
  }
}

// The serve command runs from the target's cwd, so its config does too
export function enterTaskCwd(options: { cwd?: string }) {
  if (options.cwd) process.chdir(resolve(options.cwd));
}

/**
 * The fallback readyWhen of the inferred serve targets. Runs in the env and
 * with the options of the serve task, reads the config the way `rspack serve`
 * does, and waits for the dev server it starts.
 */
export async function waitForRspackDevServer(configPath: string) {
  const options = readTaskOptions();
  const flags = parseServeFlags(options);
  // The config's file name, in the cwd of the serve task
  const absoluteConfigPath = resolve(options.cwd ?? '.', configPath);
  enterTaskCwd(options);
  // `rspack serve` sets it before it loads the config
  if (flags.nodeEnv) process.env.NODE_ENV ??= flags.nodeEnv;
  // Skips NxAppRspackPlugin's option normalization, which nothing here uses
  global.NX_GRAPH_CREATION = true;

  const { getRootTsConfigPath } = require('@nx/js') as typeof import('@nx/js');
  const { resolveUserDefinedRspackConfig } =
    require('./resolve-user-defined-rspack-config') as typeof import('./resolve-user-defined-rspack-config');
  const { readRspackOptions } =
    require('./read-rspack-options') as typeof import('./read-rspack-options');
  const env = { RSPACK_SERVE: true };
  const configs = (
    await readRspackOptions(
      await resolveUserDefinedRspackConfig(
        absoluteConfigPath,
        getRootTsConfigPath()
      ),
      env,
      { env }
    )
  ).filter(
    (config) =>
      flags.configNames.length === 0 || flags.configNames.includes(config.name)
  );

  // `rspack serve` starts one dev server, for the first config with devServer
  const config = configs.find((c) => c.devServer) ?? configs[0];
  if (!config || config.devServer === false) return;
  const address = getDevServerAddress(
    config.devServer as any,
    flags,
    process.env.RSPACK_DEV_SERVER_BASE_PORT ??
      process.env.WEBPACK_DEV_SERVER_BASE_PORT
  );
  if (address) await waitForAddresses([address]);
}
