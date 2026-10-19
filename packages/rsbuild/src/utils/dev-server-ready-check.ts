import { splitShellArgs } from '@nx/devkit/internal';
import { createConnection } from 'net';
import { resolve } from 'path';

export interface RsbuildFlags {
  port?: string;
  host?: string | true;
  envMode?: string;
  envDir?: string;
  config?: string;
  configLoader?: string;
  root?: string;
  noEnv?: true;
}

type Flag = Exclude<keyof RsbuildFlags, 'noEnv'>;
const FLAGS: Flag[] = [
  'port',
  'host',
  'envMode',
  'envDir',
  'config',
  'configLoader',
  'root',
];
const SHORT_FLAGS: Record<string, Flag> = { c: 'config', r: 'root' };

/**
 * The flags `rsbuild dev` and `rsbuild preview` take from the target's
 * options: named options are forwarded as flags, unless `args`, which holds
 * the rest, sets the same flag.
 */
export function parseRsbuildFlags(
  options: Record<string, unknown>
): RsbuildFlags {
  const flags: RsbuildFlags = {};
  for (const key of FLAGS) {
    const value = options[key];
    if (typeof value === 'string' || typeof value === 'number') {
      flags[key] = String(value);
    } else if (key === 'host' && value === true) {
      flags.host = true;
    }
  }
  const args = splitShellArgs(
    Array.isArray(options.args)
      ? options.args.join(' ')
      : typeof options.args === 'string'
        ? options.args
        : ''
  );
  for (let i = 0; i < args.length; i++) {
    const [, long, short, inline] =
      args[i].match(/^(?:--([^=]+)|-([a-z]))(?:=(.*))?$/) ?? [];
    const key = (
      long
        ? long.replace(/([a-z])-([a-z])/g, (_, a, b) => a + b.toUpperCase())
        : SHORT_FLAGS[short]
    ) as Flag | 'noEnv';
    if (!key) continue;
    if (key === 'noEnv') {
      flags.noEnv = true;
      continue;
    }
    let value = inline;
    if (value === undefined && args[i + 1] && !args[i + 1].startsWith('-')) {
      value = args[++i];
    }
    if (key === 'host') flags.host = value ?? true;
    else if (FLAGS.includes(key) && value !== undefined) flags[key] = value;
  }
  return flags;
}

export type ServerAddress = { port: number; host?: string };

export function getRsbuildServerAddress(server: {
  port?: unknown;
  host?: unknown;
}): ServerAddress | null {
  const port = Number(server.port);
  if (!Number.isInteger(port) || port <= 0) return null;
  return typeof server.host === 'string' &&
    !['localhost', '0.0.0.0', '::'].includes(server.host)
    ? { port, host: server.host }
    : { port };
}

/**
 * The readyWhen of the inferred dev and preview targets when the config doesn't
 * load the signal plugin. Runs in the env and with the options of the task,
 * resolves the config the way the Rsbuild CLI does, plugins included, and
 * waits for the server's port.
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
  const cwd = resolve(options.cwd ?? '.');
  const root = resolve(cwd, flags.root ?? '.');
  process.chdir(cwd);

  const { createRsbuild, loadConfig, loadEnv } =
    require('@rsbuild/core') as typeof import('@rsbuild/core');
  // The CLI sets NODE_ENV first, then loads the env files for that mode and
  // the config, whose function form reads the command from argv
  process.env.NODE_ENV ||= command === 'dev' ? 'development' : 'production';
  const envs = flags.noEnv
    ? null
    : loadEnv({
        cwd: flags.envDir ? resolve(root, flags.envDir) : root,
        mode: flags.envMode,
      });
  process.argv[2] = command;
  const { content: config } = await loadConfig({
    cwd: root,
    // configPath is the config the CLI finds in the task's cwd, not in --root
    path: flags.config ?? (flags.root ? undefined : configPath),
    envMode: flags.envMode,
    loader: flags.configLoader as 'auto' | 'jiti' | 'native' | undefined,
  });
  if (envs) {
    config.source ??= {};
    config.source.define = { ...envs.publicVars, ...config.source.define };
  }
  config.server ??= {};
  if (flags.host !== undefined) config.server.host = flags.host;
  if (flags.port) config.server.port = Number(flags.port);

  // Rsbuild 1.0 takes the config only as rsbuildConfig
  const rsbuild = await createRsbuild({ cwd: root, rsbuildConfig: config });
  let server: { port?: unknown; host?: unknown } = config.server;
  try {
    await rsbuild.initConfigs({ action: command });
    server = rsbuild.getNormalizedConfig().server;
  } catch (e) {
    // The preview CLI normalizes the config without generating bundler configs,
    // so a plugin hook that throws there doesn't fail `rsbuild preview`
    if (command === 'dev') throw e;
  }
  const address = getRsbuildServerAddress(server);
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
