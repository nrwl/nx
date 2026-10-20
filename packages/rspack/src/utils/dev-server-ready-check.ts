import {
  getForwardedArgs,
  getInstalledPackageVersion,
  getServerAddress,
  parseCacArgs,
  readModulePackageJson,
  resolveStartupHost,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';
import type { Configuration } from '@rspack/core';
import { existsSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { gte, lt, major } from 'semver';
import { fileURLToPath } from 'url';

export interface RspackCli {
  version: string;
  dir: string;
}

/** The @rspack/cli that `rspack serve` runs in the task's cwd. */
export function readRspackCli(): RspackCli | null {
  try {
    const { packageJson, path } = readModulePackageJson('@rspack/cli', [
      process.cwd(),
    ]);
    return { version: packageJson.version, dir: dirname(path) };
  } catch {
    return null;
  }
}

export interface ServeFlags {
  /** The overrides `rspack serve` applies to the config's devServer. */
  port?: unknown;
  host?: unknown;
  nodeEnv?: unknown;
  config?: string;
  configNames: string[];
  env: Record<string, unknown>;
  /** What `rspack serve` passes to a function config as its second argument. */
  argv: Record<string, unknown>;
}

/**
 * What `rspack serve` reads from the task's options, as run-commands forwards
 * them, parsed the way the task's @rspack/cli parses them: with cac from 1.6,
 * with yargs before. Without an installed CLI, parses them as the latest does.
 */
export function parseServeFlags(
  options: Record<string, unknown>,
  cli: RspackCli | null
): ServeFlags {
  const args = getForwardedArgs(options);
  if (cli && lt(cli.version, '1.6.0')) {
    const parsed = parseYargsServeOptions(args, cli);
    const env = getServeEnv(parsed.env);
    return {
      // The CLI applies them with `||`
      port: parsed.port || undefined,
      host: parsed.host || undefined,
      nodeEnv: parsed.nodeEnv,
      config: parsed.config,
      configNames: parsed.configName ?? [],
      env,
      argv: { ...parsed, env },
    };
  }

  const v1 = !!cli && major(cli.version) === 1;
  const parsed = parseCacArgs(args, {
    aliases: {
      c: 'config',
      d: 'devtool',
      m: 'mode',
      o: 'outputPath',
      w: 'watch',
    },
    booleans: v1 ? ['analyze', 'profile', 'w'] : ['w'],
  });
  // Options of type [String]
  const strings = (value: unknown) => [value ?? []].flat().map(String);
  const configNames = strings(parsed.configName);
  const entry = strings(parsed.entry);
  const env = getServeEnv(strings(parsed.env));
  const argv: Record<string, unknown> = {
    configLoader: v1 ? 'register' : 'auto',
    ...parsed,
    configName: configNames.length > 0 ? configNames : undefined,
    entry: entry.length > 0 ? entry : undefined,
    env,
    hot:
      parsed.hot === 'false'
        ? false
        : parsed.hot === 'true'
          ? true
          : parsed.hot,
  };
  if ('devtool' in parsed) argv.devtool = normalizeDevtool(parsed.devtool);
  return {
    port: parsed.port,
    host: parsed.host || undefined,
    nodeEnv: parsed.nodeEnv,
    config: parsed.config as string,
    configNames,
    env,
    argv,
  };
}

function normalizeDevtool(value: unknown) {
  if (typeof value === 'boolean') return value ? 'source-map' : false;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'false') return false;
  return trimmed === 'true' ? 'source-map' : trimmed;
}

/**
 * The options of `rspack serve` in @rspack/cli 1.0 to 1.5, parsed by the yargs
 * that CLI depends on, with its option table for the version.
 */
function parseYargsServeOptions(
  args: string[],
  cli: RspackCli
): Record<string, any> {
  const yargs = require(require.resolve('yargs', { paths: [cli.dir] }));
  return yargs()
    .scriptName('rspack')
    .help(false)
    .version(false)
    .options({
      config: { type: 'string', alias: 'c' },
      configName: { type: 'array', string: true },
      ...(gte(cli.version, '1.2.0') && {
        configLoader: { type: 'string', default: 'register' },
      }),
      nodeEnv: { string: true },
      entry: { type: 'array', string: true },
      outputPath: { type: 'string', alias: 'o' },
      mode: { type: 'string', alias: 'm' },
      watch: { type: 'boolean', default: false, alias: 'w' },
      env: { type: 'array', string: true },
      devtool: lt(cli.version, '1.4.0')
        ? { type: 'boolean', default: false, alias: 'd' }
        : {
            type: 'string',
            alias: 'd',
            coerce: (value: string) =>
              value === 'true'
                ? 'source-map'
                : value === 'false' || value.trim() === ''
                  ? false
                  : value,
          },
      hot: {
        coerce: (value: unknown) =>
          typeof value === 'boolean' || value === 'only'
            ? value
            : value !== 'false',
      },
      port: {
        type: 'number',
        coerce: (value: unknown) =>
          Number.isInteger(value) ? value : undefined,
      },
      host: { type: 'string' },
    })
    .parse(['serve', ...args]);
}

/** The env object `rspack serve` passes to a function config. */
function getServeEnv(values: string[] = []): Record<string, unknown> {
  const env = parseEnv(values);
  if (!('RSPACK_SERVE' in env)) env.RSPACK_SERVE = true;
  return env;
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
function getDevServerMajorVersion(cli: RspackCli | null): number | null {
  if (!cli) return null;
  const version = getInstalledPackageVersion('@rspack/dev-server', [cli.dir]);
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

/**
 * Where a dev server listens, or null when it picks its port or listens on a
 * socket. Returns null for those, since nothing can be probed ahead of them.
 */
export function getDevServerAddress(
  devServer: { port?: unknown; host?: unknown; ipc?: unknown } | undefined,
  flags: ServeFlags,
  basePort: string | undefined
): ServerAddress | null {
  if (devServer?.ipc) return null;
  const host = flags.host ?? devServer?.host;
  return getServerAddress(
    flags.port ?? devServer?.port ?? basePort ?? 8080,
    // `local-ip` and friends resolve to an interface address first, the way
    // the dev server resolves them
    typeof host === 'string' ? resolveStartupHost(host) : undefined
  );
}

/**
 * The readyWhen of the inferred serve targets when the config doesn't load the
 * signal plugin. Runs in the env and with the options of the serve task, reads
 * the config the way `rspack serve` does, and waits for the dev server it
 * starts.
 */
export async function waitForRspackDevServer(configPath: string) {
  await runReadyCheck(async ({ options, root }) => {
    const cli = readRspackCli();
    const flags = parseServeFlags(options, cli);
    // The config's file name, in the cwd of the serve task
    const absoluteConfigPath = resolve(root, flags.config ?? configPath);
    // `rspack serve` sets it before it loads the config
    process.env.NODE_ENV ??=
      typeof flags.nodeEnv === 'string' ? flags.nodeEnv : 'development';
    // Dev server 1.x reads the webpack-dev-server names
    const devServerEnv =
      getDevServerMajorVersion(cli) === 1 ? 'WEBPACK' : 'RSPACK';
    // The dev server sets it on import, which `rspack serve` does before it
    // loads the config
    process.env[`${devServerEnv}_SERVE`] ||= 'true';
    // Skips NxAppRspackPlugin's option normalization, which nothing here uses
    global.NX_GRAPH_CREATION = true;

    const { getRootTsConfigPath } =
      require('@nx/js') as typeof import('@nx/js');
    const { resolveUserDefinedRspackConfig } =
      require('./resolve-user-defined-rspack-config') as typeof import('./resolve-user-defined-rspack-config');
    const { readRspackOptions } =
      require('./read-rspack-options') as typeof import('./read-rspack-options');
    const { env, argv } = flags;
    const tsConfig = getRootTsConfigPath();
    const load = async (path: string) => {
      const config = await resolveUserDefinedRspackConfig(path, tsConfig);
      return typeof config === 'function' ? await config(env, argv) : config;
    };
    let configs = await Promise.all(
      (
        await readRspackOptions(
          await resolveUserDefinedRspackConfig(absoluteConfigPath, tsConfig),
          env,
          argv
        )
      ).map((config) => applyExtends(config, absoluteConfigPath, load))
    );
    // In the order of the names, as `rspack serve` picks them
    if (flags.configNames.length > 0) {
      configs = flags.configNames
        .map((name) => configs.find((config) => config.name === name))
        .filter(Boolean);
    }

    // `rspack serve` starts one dev server, for the first config with devServer,
    // and serves a `devServer: false` config with the defaults
    const config = configs.find((c) => c.devServer) ?? configs[0];
    if (!config) return null;
    const address = getDevServerAddress(
      (config.devServer || undefined) as any,
      flags,
      process.env[`${devServerEnv}_DEV_SERVER_BASE_PORT`]
    );
    return address ? [address] : null;
  });
}
