import {
  getForwardedArgs,
  getServerAddress,
  loadConfigFile,
  resolveStartupHost,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';
import { createRequire } from 'module';
import { resolve } from 'path';
import type { Configuration } from 'webpack';

export interface ServeFlags {
  port?: number | string;
  host?: string;
  configNames: string[];
  configs: string[];
  merge: boolean;
  env: Record<string, unknown>;
  extends: string[];
}

/** The flags of `webpack-cli serve` the check reads, from its parsed argv. */
export function parseServeFlags(argv: Record<string, any>): ServeFlags {
  const env = {};
  for (const value of argv.env ?? []) parseEnv(value, env);
  return {
    port: argv.port,
    host: argv.host,
    configNames: argv.configName ?? [],
    configs: argv.config ?? [],
    merge: !!argv.merge,
    env,
    extends: argv.extends ?? [],
  };
}

interface CliArgument {
  configs?: { type: string; values?: unknown[] }[];
  multiple?: boolean;
  alias?: string;
}

const stringConfig = [{ type: 'string' }];
const flagConfig = [{ type: 'enum', values: [true] }];
// webpack-cli's own options in any of its majors
const CLI_OPTIONS: Record<string, CliArgument> = {
  config: { alias: 'c', configs: stringConfig, multiple: true },
  'config-name': { configs: stringConfig, multiple: true },
  merge: { alias: 'm', configs: flagConfig },
  'disable-interpret': { configs: flagConfig },
  env: { configs: stringConfig, multiple: true },
  'node-env': { configs: stringConfig },
  'define-process-env-node-env': { configs: stringConfig },
  'config-node-env': { configs: stringConfig },
  analyze: { configs: flagConfig },
  progress: { configs: [...stringConfig, ...flagConfig] },
  json: { alias: 'j', configs: [...stringConfig, ...flagConfig] },
  'fail-on-warnings': { configs: flagConfig },
  extends: { alias: 'e', configs: stringConfig, multiple: true },
};
const CORE_ALIASES: Record<string, string> = {
  devtool: 'd',
  'output-path': 'o',
  target: 't',
  watch: 'w',
};
const VALUE_TYPES: Record<string, 'boolean' | 'number' | 'string'> = {
  boolean: 'boolean',
  reset: 'boolean',
  number: 'number',
  string: 'string',
  path: 'string',
  RegExp: 'string',
};

/**
 * The options `webpack-cli serve` parses from the task's options, as
 * run-commands forwards them. webpack-cli passes them to a function config as
 * `argv`, with `env` parsed from the `--env` values. Parses the args with
 * webpack-cli's commander and types each value by its argument in webpack-cli,
 * webpack or webpack-dev-server.
 */
export function parseServeArgv(
  options: Record<string, unknown>
): Record<string, any> {
  const tokens = getForwardedArgs(options);
  // Registers only the options the args can name, since only those set a value
  const named = new Set(
    tokens.flatMap((token) => {
      if (!token.startsWith('-')) return [];
      if (!token.startsWith('--')) return [...token.slice(1)];
      const name = token.slice(2).split('=')[0];
      return [name, name.replace(/^no-/, '')];
    })
  );
  if (named.size === 0) return {};

  const cliRequire = createWebpackCliRequire();
  const { Command, Option } = cliRequire('commander');
  const webpack = cliRequire('webpack') as typeof import('webpack');
  const args: Record<string, CliArgument> = {
    ...webpack.cli.getArguments(),
    ...webpack.cli.getArguments(cliRequire('webpack-dev-server').schema),
    ...CLI_OPTIONS,
  };
  const command = new Command().exitOverride();
  for (const [name, arg] of Object.entries(args)) {
    const alias = arg.alias ?? CORE_ALIASES[name];
    if (named.has(name) || named.has(alias)) {
      addCliOption(command, Option, name, { ...arg, alias });
    }
  }
  // webpack-cli's program parses the args at least twice before `serve` does,
  // and each pass drops a `--` that comes before any option it doesn't know
  const program = new Command().option('--color').option('--no-color');
  let serveArgs = ['serve', ...tokens];
  for (let pass = 0; pass < 2; pass++) {
    const { operands, unknown } = program.parseOptions(serveArgs);
    serveArgs = [...operands, ...unknown];
  }
  command.parseOptions(serveArgs.slice(1));
  return command.opts();
}

// Ports webpack-cli's makeOption
function addCliOption(
  command: any,
  Option: any,
  name: string,
  { configs = [], multiple, alias }: CliArgument
) {
  const types = new Set<string>();
  let negatable = false;
  for (const { type, values = [] } of configs) {
    if (type === 'enum') {
      for (const value of values) {
        const valueType = VALUE_TYPES[typeof value];
        if (value === false) negatable = true;
        else if (valueType) types.add(valueType);
      }
    } else if (VALUE_TYPES[type]) {
      types.add(VALUE_TYPES[type]);
      negatable ||= type === 'boolean';
    }
  }
  if (types.size === 0 && !negatable) return;
  const takesValue = types.size > (types.has('boolean') ? 1 : 0);
  const variadic = multiple ? '...' : '';
  const placeholder = types.has('boolean')
    ? ` [value${variadic}]`
    : ` <value${variadic}>`;
  const option = new Option(
    `${alias ? `-${alias}, ` : ''}--${name}${takesValue ? placeholder : ''}`
  );
  if (takesValue) {
    option.argParser((value: string, prev: unknown = []) => {
      const number = Number(value);
      if (types.has('number') && (types.size === 1 || !isNaN(number))) {
        return multiple ? [prev, number].flat() : number;
      }
      return multiple && types.has('string') ? [prev, value].flat() : value;
    });
  }
  command.addOption(option);
  if (negatable) command.addOption(new Option(`--no-${name}`));
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

// webpack-cli runs from the task's cwd and loads its dependencies from its own
// location
function createWebpackCliRequire(): NodeJS.Require {
  return createRequire(
    require.resolve('webpack-cli', { paths: [process.cwd()] })
  );
}

function loadWebpackMerge(): Merge {
  return createWebpackCliRequire()('webpack-merge').merge;
}

/**
 * The readyWhen of the inferred serve targets when the config doesn't load the
 * signal plugin. Runs in the env and with the options of the serve task, reads
 * the config the way `webpack-cli serve` does, and waits for each dev server it
 * starts.
 */
export async function waitForWebpackDevServer(configPath: string) {
  await runReadyCheck(async ({ options, root }) => {
    const parsed = parseServeArgv(options);
    const flags = parseServeFlags(parsed);
    // Skips NxAppWebpackPlugin's option normalization, which nothing here uses
    global.NX_GRAPH_CREATION = true;

    const { readWebpackOptions } =
      require('./webpack/read-webpack-options') as typeof import('./webpack/read-webpack-options');
    const env = { WEBPACK_SERVE: true, ...flags.env };
    const argv = { ...parsed, env };
    const load = async (path: string) =>
      readWebpackOptions(await loadConfigExport(resolve(path)), env, argv);
    let configs = (
      await Promise.all(
        // The config's file name, in the cwd of the serve task
        (flags.configs.length > 0
          ? flags.configs
          : [resolve(root, configPath)]
        ).map(load)
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
    return addresses.some((address) => address === null) ? null : addresses;
  });
}
