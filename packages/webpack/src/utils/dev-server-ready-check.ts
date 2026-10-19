import {
  loadConfigFile,
  resolveStartupHost,
  splitShellArgs,
} from '@nx/devkit/internal';
import { createRequire } from 'module';
import { createConnection } from 'net';
import { resolve } from 'path';
import type { Configuration } from 'webpack';

export interface ServeFlags {
  port?: string;
  host?: string;
  configNames: string[];
  configs: string[];
  merge: boolean;
  env: Record<string, unknown>;
  extends: string[];
}

const SHORT_FLAGS: Record<string, string> = {
  c: 'config',
  m: 'merge',
  e: 'extends',
};
const VARIADIC_FLAGS = new Set(['config', 'config-name', 'env', 'extends']);
// The flags read here that webpack-cli accepts as `--name=value`, the form
// run-commands gives named options
const NAMED_FLAGS = ['port', 'host', 'config', 'config-name', 'extends'];

/**
 * The flags `webpack-cli serve` gets from the target's options, in the order
 * run-commands passes them: named options, `args`, then overrides.
 */
export function parseServeFlags(options: Record<string, unknown>): ServeFlags {
  const flags: ServeFlags = {
    configNames: [],
    configs: [],
    merge: false,
    env: {},
    extends: [],
  };
  const set = (name: string, value: string) => {
    if (name === 'port') flags.port = value;
    else if (name === 'host') flags.host = value;
    else if (name === 'config-name') flags.configNames.push(value);
    else if (name === 'config') flags.configs.push(value);
    else if (name === 'extends') flags.extends.push(value);
    else if (name === 'env') parseEnv(value, flags.env);
  };
  const argv = getServeArgv(options);
  const isValue = (arg: string | undefined) => arg && !arg.startsWith('-');
  for (let i = 0; i < argv.length; i++) {
    const [, long, inline] = argv[i].match(/^--([^=]+)(?:=(.*))?$/) ?? [];
    const [, short, attached] = long
      ? []
      : (argv[i].match(/^-(.)(.+)?$/) ?? []);
    const name = long ?? SHORT_FLAGS[short];
    if (!name) continue;
    if (name === 'merge') {
      flags.merge = true;
      continue;
    }
    const value =
      inline ?? attached ?? (isValue(argv[i + 1]) ? argv[++i] : undefined);
    if (value === undefined) continue;
    set(name, value);
    // Commander continues a variadic list only after a value in its own arg
    if (
      inline === undefined &&
      attached === undefined &&
      VARIADIC_FLAGS.has(name)
    ) {
      while (isValue(argv[i + 1])) set(name, argv[++i]);
    }
  }
  return flags;
}

/**
 * The `argv` webpack-cli passes to a function config: its commander options,
 * with `env` set by the caller. Values stay strings except `--port`, which
 * webpack-cli converts to a number when it is numeric.
 */
export function parseServeArgv(
  options: Record<string, unknown>,
  env: Record<string, unknown>
): Record<string, unknown> {
  const argv: Record<string, unknown> = {};
  const tokens = getServeArgv(options);
  const isValue = (arg: string | undefined) => arg && !arg.startsWith('-');
  for (let i = 0; i < tokens.length; i++) {
    const [, long, inline] = tokens[i].match(/^--([^=]+)(?:=(.*))?$/) ?? [];
    const [, short, attached] = long
      ? []
      : (tokens[i].match(/^-(.)(.+)?$/) ?? []);
    const flag = long ?? SHORT_FLAGS[short];
    if (!flag) continue;
    const negated = flag.startsWith('no-');
    const name = (negated ? flag.slice(3) : flag).replace(/-([a-z])/g, (_, c) =>
      c.toUpperCase()
    );
    if (negated) {
      argv[name] = false;
      continue;
    }
    const values: string[] = [];
    const first =
      inline ?? attached ?? (isValue(tokens[i + 1]) ? tokens[++i] : undefined);
    if (first !== undefined) {
      values.push(first);
      if (
        inline === undefined &&
        attached === undefined &&
        VARIADIC_FLAGS.has(flag)
      ) {
        while (isValue(tokens[i + 1])) values.push(tokens[++i]);
      }
    }
    if (flag === 'env') continue;
    if (VARIADIC_FLAGS.has(flag)) {
      argv[name] = [...((argv[name] as string[]) ?? []), ...values];
    } else if (values.length === 0) {
      argv[name] = true;
    } else {
      const value = values[0];
      argv[name] =
        flag === 'port' && value.trim() !== '' && !isNaN(Number(value))
          ? Number(value)
          : value;
    }
  }
  return { ...argv, env };
}

function getServeArgv(options: Record<string, unknown>): string[] {
  const args = splitShellArgs(
    Array.isArray(options.args)
      ? options.args.join(' ')
      : typeof options.args === 'string'
        ? options.args
        : ''
  );
  const unparsed = Array.isArray(options.__unparsed__)
    ? options.__unparsed__.map(String)
    : [];
  // run-commands drops a named option that overrides set, or that args set to
  // another value
  const named = NAMED_FLAGS.filter((name) => {
    const value = options[name];
    const fromArgs = flagValues(args, name);
    return (
      ['string', 'number', 'boolean'].includes(typeof value) &&
      flagValues(unparsed, name).length === 0 &&
      (fromArgs.length === 0 ||
        (fromArgs.length === 1 && fromArgs[0] === String(value)))
    );
  }).map((name) => `--${name}=${options[name]}`);
  // run-commands keeps `--env` for itself and drops it from the overrides,
  // with the value it parsed for it
  const env = flagValues(unparsed, 'env');
  const envValue = String(env.length === 1 ? env[0] : env);
  const overrides = unparsed.filter(
    (arg, i) =>
      !/^--env(=|$|\.[^=]*=)/.test(arg) &&
      !(unparsed[i - 1] === '--env' && arg === envValue)
  );
  return [...named, ...args, ...overrides];
}

// The values yargs-parser reads for `--name`, as strings
function flagValues(argv: string[], name: string): Array<string | boolean> {
  const values: Array<string | boolean> = [];
  argv.forEach((arg, i) => {
    if (arg === `--no-${name}`) values.push(false);
    else if (arg.startsWith(`--${name}=`)) {
      values.push(arg.slice(name.length + 3));
    } else if (arg === `--${name}`) {
      const next = argv[i + 1];
      values.push(next && !next.startsWith('-') ? next : true);
    }
  });
  return values;
}

// webpack-cli's `--env` parser, edge cases included
function parseEnv(value: string, env: Record<string, any>) {
  const [allKeys, val] = value.split(/[=](.+)/, 2);
  const splitKeys = allKeys.split(/\.(?!$)/);
  let prevRef = env;
  for (let [index, someKey] of splitKeys.entries()) {
    if (someKey.endsWith('=')) {
      someKey = someKey.slice(0, -1);
      prevRef[someKey] = undefined;
      continue;
    }
    if (!prevRef[someKey] || typeof prevRef[someKey] === 'string') {
      prevRef[someKey] = {};
    }
    if (index === splitKeys.length - 1) {
      prevRef[someKey] = typeof val === 'string' ? val : true;
    }
    prevRef = prevRef[someKey];
  }
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

async function loadConfigExport(path: string): Promise<unknown> {
  if (/\.(ts|mts|cts)$/.test(path)) {
    const { getRootTsConfigPath } =
      require('@nx/js') as typeof import('@nx/js');
    const { resolveUserDefinedWebpackConfig } =
      require('./webpack/resolve-user-defined-webpack-config') as typeof import('./webpack/resolve-user-defined-webpack-config');
    return resolveUserDefinedWebpackConfig(path, getRootTsConfigPath());
  }
  const config = await loadConfigFile(path);
  // webpack-cli also unwraps a default export's own `default`
  return config && typeof config === 'object' && 'default' in config
    ? config.default
    : config;
}

type Merge = (...configs: Configuration[]) => Configuration;

// webpack-cli merges with its own webpack-merge, and runs from the task's cwd
function loadWebpackMerge(): Merge {
  const cliRequire = createRequire(
    require.resolve('webpack-cli', { paths: [process.cwd()] })
  );
  return cliRequire('webpack-merge').merge;
}

/**
 * The readyWhen of the inferred serve targets when the config doesn't load the
 * signal plugin. Runs in the env and with the options of the serve task, reads
 * the config the way `webpack-cli serve` does, and waits for each dev server it
 * starts.
 */
export async function waitForWebpackDevServer(configPath: string) {
  const options = readTaskOptions();
  const flags = parseServeFlags(options);
  // The config's file name, in the cwd of the serve task
  const absoluteConfigPath = resolve(options.cwd ?? '.', configPath);
  enterTaskCwd(options);
  // Skips NxAppWebpackPlugin's option normalization, which nothing here uses
  global.NX_GRAPH_CREATION = true;

  const { readWebpackOptions } =
    require('./webpack/read-webpack-options') as typeof import('./webpack/read-webpack-options');
  const env = { WEBPACK_SERVE: true, ...flags.env };
  const argv = parseServeArgv(options, env);
  const load = async (path: string) =>
    readWebpackOptions(await loadConfigExport(resolve(path)), env, argv);
  let configs = (
    await Promise.all(
      (flags.configs.length > 0 ? flags.configs : [absoluteConfigPath]).map(
        load
      )
    )
  )
    .flat()
    .filter(
      (config) =>
        flags.configNames.length === 0 ||
        flags.configNames.includes(config.name)
    );

  let webpackMerge: Merge | undefined;
  const merge: Merge = (...configs) =>
    (webpackMerge ??= loadWebpackMerge())(...configs);
  const resolveExtends = async (
    config: Configuration,
    extendsPaths: string[],
    seen: string[]
  ): Promise<Configuration> => {
    delete config.extends;
    const paths = extendsPaths.map((path) => resolve(path));
    if (paths.some((path) => seen.includes(path))) {
      throw new Error('Recursive configuration detected.');
    }
    const extended = (await Promise.all(paths.map(load))).flat();
    if (extended.length > 0) config = merge(...extended, config);
    return config.extends
      ? resolveExtends(config, [config.extends].flat(), [...seen, ...paths])
      : config;
  };
  configs = await Promise.all(
    configs.map((config) =>
      flags.extends.length > 0
        ? resolveExtends(config, flags.extends, [])
        : config.extends
          ? resolveExtends(config, [config.extends].flat(), [])
          : config
    )
  );
  if (flags.merge) {
    if (configs.length < 2) {
      throw new Error('At least two configurations are required for merge.');
    }
    configs = [configs.reduce((merged, config) => merge(merged, config), {})];
  }

  // webpack-cli starts a dev server for every config with devServer, or for
  // the first config when none has one
  const withDevServer = configs.filter((config) => config.devServer);
  const servers =
    withDevServer.length > 0 ? withDevServer : configs.slice(0, 1);
  const addresses = servers
    .filter((config) => (config.devServer as unknown) !== false)
    .map((config) =>
      getDevServerAddress(
        config.devServer as any,
        flags,
        process.env.WEBPACK_DEV_SERVER_BASE_PORT
      )
    );
  if (addresses.some((address) => address === null)) return;
  await waitForAddresses(addresses);
}
