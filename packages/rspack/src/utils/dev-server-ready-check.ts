import {
  getInstalledPackageVersion,
  readModulePackageJson,
  resolveStartupHost,
  splitShellArgs,
} from '@nx/devkit/internal';
import type { Configuration } from '@rspack/core';
import { existsSync } from 'fs';
import { createConnection } from 'net';
import { dirname, extname, resolve } from 'path';
import { major } from 'semver';
import { fileURLToPath } from 'url';

export interface ServeFlags {
  port?: string;
  host?: string;
  nodeEnv?: string;
  config?: string;
  configNames: string[];
  env: string[];
}

/**
 * The flags `rspack serve` takes from the target's options. run-commands
 * forwards named options, then `args`, then overrides, and a later source wins.
 */
export function parseServeFlags(options: Record<string, unknown>): ServeFlags {
  const args = parseArgs(splitArgs(options.args));
  // run-commands doesn't forward `--env` overrides, since `env` is its own option
  const overrides = parseArgs(overrideArgs(options.__unparsed__));
  const option = (...keys: string[]) =>
    keys
      .map((key) => options[key])
      .find((value) => typeof value === 'string' || typeof value === 'number')
      ?.toString();
  // Repeated `--config-name` flags add up, and replace a named configName
  const configNames = [...args.configNames, ...overrides.configNames];
  const configName = option('configName', 'config-name');
  return {
    port: overrides.port ?? args.port ?? option('port'),
    host: overrides.host ?? args.host ?? option('host'),
    nodeEnv: overrides.nodeEnv ?? args.nodeEnv ?? option('nodeEnv', 'node-env'),
    config: overrides.config ?? args.config ?? option('config', 'c'),
    configNames:
      configNames.length > 0 ? configNames : configName ? [configName] : [],
    env: args.env,
  };
}

// run-commands leaves `args` for the shell to split, and quotes each override
// so it stays one argument
function splitArgs(value: unknown): string[] {
  return splitShellArgs(
    Array.isArray(value)
      ? value.join(' ')
      : typeof value === 'string'
        ? value
        : ''
  );
}

function overrideArgs(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function parseArgs(args: string[]): ServeFlags {
  const flags: ServeFlags = { configNames: [], env: [] };
  for (let i = 0; i < args.length; i++) {
    const [, name, inline] =
      args[i].match(/^--([^=]+)(?:=(.*))?$/) ??
      args[i].match(/^-(c)(?:=(.*))?$/) ??
      [];
    if (!name) continue;
    let value = inline;
    if (value === undefined && args[i + 1] && !args[i + 1].startsWith('-')) {
      value = args[++i];
    }
    if (name === 'port') flags.port = value;
    else if (name === 'host') flags.host = value;
    else if (name === 'node-env') flags.nodeEnv = value;
    else if (name === 'config' || name === 'c') flags.config = value;
    else if (name === 'config-name' && value) flags.configNames.push(value);
    else if (name === 'env' && value) flags.env.push(value);
  }
  return flags;
}

const SHORT_FLAGS: Record<string, string> = {
  c: 'config',
  d: 'devtool',
  m: 'mode',
  o: 'output-path',
  w: 'watch',
};
const ARRAY_FLAGS = new Set(['config-name', 'entry']);
// Named options run-commands forwards that the check reads
const NAMED_FLAGS: Array<[flag: string, ...keys: string[]]> = [
  ['port', 'port'],
  ['host', 'host'],
  ['mode', 'mode'],
  ['node-env', 'nodeEnv', 'node-env'],
  ['config', 'config', 'c'],
  ['config-name', 'configName', 'config-name'],
];

/**
 * The `argv` @rspack/cli passes to a function config: its parsed options,
 * with `env` set by the caller. Values follow its mri parser: a numeric value
 * is a number, a bare flag is true, `--no-x` is false, a repeated flag is an
 * array.
 */
export function parseServeArgv(
  options: Record<string, unknown>,
  env: Record<string, unknown>
): Record<string, unknown> {
  const tokens = [
    ...splitArgs(options.args),
    ...overrideArgs(options.__unparsed__),
  ];
  const given = new Set(tokens.map((token) => token.match(/^--([^=]+)/)?.[1]));
  const named = NAMED_FLAGS.flatMap(([flag, ...keys]) => {
    const value = keys
      .map((key) => options[key])
      .find((v) => typeof v === 'string' || typeof v === 'number');
    return value === undefined || given.has(flag) ? [] : [`--${flag}=${value}`];
  });
  const argv: Record<string, unknown> = {};
  const all = [...named, ...tokens];
  for (let i = 0; i < all.length; i++) {
    const [, dashes, rawName, inline] =
      all[i].match(/^(--?)([^=]+)(?:=(.*))?$/) ?? [];
    if (!rawName) continue;
    const flag = dashes === '-' ? SHORT_FLAGS[rawName] : rawName;
    if (!flag) continue;
    const negated = flag.startsWith('no-');
    const base = negated ? flag.slice(3) : flag;
    const name = base.replace(
      /([a-z])-([a-z])/g,
      (_, a, b) => a + b.toUpperCase()
    );
    if (negated) {
      argv[name] = false;
      continue;
    }
    const next =
      inline ?? (all[i + 1] && !all[i + 1].startsWith('-') ? all[++i] : '');
    if (flag === 'env') continue;
    const value =
      next === '' ? true : Number.isFinite(Number(next)) ? Number(next) : next;
    const previous = argv[name];
    argv[name] =
      previous === undefined
        ? ARRAY_FLAGS.has(flag)
          ? [value]
          : value
        : [previous, value].flat();
  }
  return { ...argv, env };
}

const UNSAFE_ENV_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** The env object `rspack serve` builds from its `--env` values. */
function parseEnv(values: string[]): Record<string, any> {
  const env: Record<string, any> = {};
  for (const value of values) {
    const [allKeys, val] = value.split(/=(.+)/, 2);
    const keys = allKeys.split(/\.(?!$)/);
    if (keys.some((key) => UNSAFE_ENV_KEYS.has(key.replace(/=$/, '')))) {
      continue;
    }
    let ref = env;
    for (const [index, key] of keys.entries()) {
      if (key.endsWith('=')) {
        ref[key.slice(0, -1)] = undefined;
        continue;
      }
      if (!ref[key] || typeof ref[key] === 'string') ref[key] = {};
      if (index === keys.length - 1) {
        ref[key] = typeof val === 'string' ? val : true;
      }
      ref = ref[key];
    }
  }
  return env;
}

// `rspack serve` loads the @rspack/dev-server its own @rspack/cli resolves
function getDevServerMajorVersion(): number | null {
  let cliPackageJsonPath: string;
  try {
    cliPackageJsonPath = readModulePackageJson('@rspack/cli', [
      process.cwd(),
    ]).path;
  } catch {
    return null;
  }
  const version = getInstalledPackageVersion('@rspack/dev-server', [
    dirname(cliPackageJsonPath),
  ]);
  return version ? major(version) : null;
}

const CONFIG_EXTENSIONS = ['.ts', '.js', '.mts', '.mjs', '.cts', '.cjs'];

function resolveExtendedConfig(request: string, baseDir: string): string {
  if (request.startsWith('file://')) return fileURLToPath(request);
  if (
    request.startsWith('.') ||
    request.startsWith('/') ||
    request.includes(':\\')
  ) {
    const path = resolve(baseDir, request);
    const found = extname(path)
      ? path
      : CONFIG_EXTENSIONS.map((ext) => path + ext).find(existsSync);
    if (!found) {
      throw new Error(`Extended configuration file "${path}" not found.`);
    }
    return found;
  }
  return require.resolve(request, { paths: [baseDir, process.cwd()] });
}

/** Applies `extends` the way `rspack serve` does. */
async function applyExtends(
  config: Configuration,
  configPath: string,
  load: (path: string) => Promise<unknown>,
  extending: string[] = []
): Promise<Configuration> {
  if (extending.includes(configPath)) {
    throw new Error(
      `Recursive configuration detected. Config file "${configPath}" extends itself.`
    );
  }
  let merged = config;
  for (const request of config.extends ? [config.extends].flat() : []) {
    const path = resolveExtendedConfig(request, dirname(configPath));
    const base = await load(path);
    merged = mergeExtendedConfig(
      isPlainObject(base)
        ? await applyExtends(base, path, load, [...extending, configPath])
        : {},
      merged
    );
  }
  return merged;
}

// Merges the fields read here as both @rspack/cli majors do: the extending
// config wins unless undefined, and devServer objects merge by key
function mergeExtendedConfig(base: Configuration, config: Configuration) {
  const merged = mergeDefined(base, config);
  if (isPlainObject(base.devServer) && isPlainObject(config.devServer)) {
    merged.devServer = mergeDefined(base.devServer, config.devServer);
  }
  return merged;
}

function mergeDefined<T extends object>(base: T, value: T): T {
  const merged = { ...base };
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) merged[key] = entry;
  }
  return merged;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
 * The readyWhen of the inferred serve targets when the config doesn't load the
 * signal plugin. Runs in the env and with the options of the serve task, reads
 * the config the way `rspack serve` does, and waits for the dev server it
 * starts.
 */
export async function waitForRspackDevServer(configPath: string) {
  const options = readTaskOptions();
  const flags = parseServeFlags(options);
  // The config's file name, in the cwd of the serve task
  const absoluteConfigPath = resolve(
    options.cwd ?? '.',
    flags.config ?? configPath
  );
  enterTaskCwd(options);
  // `rspack serve` sets it before it loads the config
  process.env.NODE_ENV ??= flags.nodeEnv ?? 'development';
  // Dev server 1.x reads the webpack-dev-server names
  const devServerEnv = getDevServerMajorVersion() === 1 ? 'WEBPACK' : 'RSPACK';
  // The dev server sets it on import, which `rspack serve` does before it
  // loads the config
  process.env[`${devServerEnv}_SERVE`] ||= 'true';
  // Skips NxAppRspackPlugin's option normalization, which nothing here uses
  global.NX_GRAPH_CREATION = true;

  const { getRootTsConfigPath } = require('@nx/js') as typeof import('@nx/js');
  const { resolveUserDefinedRspackConfig } =
    require('./resolve-user-defined-rspack-config') as typeof import('./resolve-user-defined-rspack-config');
  const { readRspackOptions } =
    require('./read-rspack-options') as typeof import('./read-rspack-options');
  const env = parseEnv(flags.env);
  if (!('RSPACK_SERVE' in env)) env.RSPACK_SERVE = true;
  const argv = parseServeArgv(options, env);
  const tsConfig = getRootTsConfigPath();
  const load = async (path: string) => {
    const config = await resolveUserDefinedRspackConfig(path, tsConfig);
    return typeof config === 'function' ? await config(env, argv) : config;
  };
  const configs = (
    await Promise.all(
      (
        await readRspackOptions(
          await resolveUserDefinedRspackConfig(absoluteConfigPath, tsConfig),
          env,
          argv
        )
      ).map((config) => applyExtends(config, absoluteConfigPath, load))
    )
  ).filter(
    (config) =>
      flags.configNames.length === 0 || flags.configNames.includes(config.name)
  );

  // `rspack serve` starts one dev server, for the first config with devServer,
  // and serves a `devServer: false` config with the defaults
  const config = configs.find((c) => c.devServer) ?? configs[0];
  if (!config) return;
  const address = getDevServerAddress(
    (config.devServer || undefined) as any,
    flags,
    process.env[`${devServerEnv}_DEV_SERVER_BASE_PORT`]
  );
  if (address) await waitForAddresses([address]);
}
