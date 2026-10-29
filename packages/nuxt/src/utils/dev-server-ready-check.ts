import { readJsonFile } from '@nx/devkit';
import {
  getForwardedArgs,
  getInstalledPackageVersion,
  getServerAddress,
  readModulePackageJson,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';
import { existsSync, lstatSync, realpathSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { gte, valid } from 'semver';
import { parseArgs } from 'util';
import { loadNuxtKitDynamicImport } from './executor-utils';
import { waitUntilServing } from './wait-until-serving';

// The first version of each range of `nuxt dev` CLIs, nuxi or @nuxt/cli, that
// load the config and resolve the address they listen on alike, latest first
const CLI_RANGES = [
  '4.0.0',
  '3.31.0',
  '3.30.0',
  '3.26.0',
  '3.25.0',
  '3.15.0',
  '3.8.4',
  '3.7.2',
  '3.7.1',
  '3.7.0',
  '3.6.2',
  '3.2.1',
  '3.1.1',
  '3.0.0',
] as const;
type CliRange = (typeof CLI_RANGES)[number];

// The `nuxt dev` options that take a value, with the aliases citty gives them
const VALUE_OPTIONS: Record<string, string[]> = {
  cwd: [],
  dotenv: [],
  profile: [],
  logLevel: ['log-level'],
  envName: ['env-name'],
  extends: ['e'],
  port: ['p'],
  host: ['h'],
  publicURL: ['public-url'],
  sslCert: ['ssl-cert'],
  sslKey: ['ssl-key'],
  'https.cert': ['httpsCert', 'https-cert'],
  'https.key': ['httpsKey', 'https-key'],
  'https.pfx': ['httpsPfx', 'https-pfx'],
  'https.passphrase': ['httpsPassphrase', 'https-passphrase'],
  'https.validityDays': ['httpsValidityDays', 'https-validity-days'],
  'https.domains': ['httpsDomains', 'https-domains'],
};
const CLI_4_VALUE_OPTIONS: Record<string, string[]> = {
  ...VALUE_OPTIONS,
  'open.url': ['openUrl', 'open-url'],
};
// The options @nuxt/cli 4 takes more than once
const CLI_4_MULTIPLE = ['dotenv', 'extends'];

interface DevServerConfig {
  port?: unknown;
  host?: unknown;
}

interface LoadedNuxtConfig {
  devServer: DevServerConfig;
  _layers?: readonly { config?: { devServer?: DevServerConfig } }[];
}

interface NuxtDevArgs {
  port?: string;
  host?: string | true;
  cwd?: string;
  rootDir?: string;
  dotenv?: string | string[];
  envName?: string;
  extends?: string | string[];
}

/**
 * The args `nuxt dev` gets from the task's options, as the citty parser of
 * its CLI reads them.
 */
function parseNuxtDevArgs(
  options: Record<string, unknown>,
  cli: CliRange
): NuxtDevArgs {
  const cli4 = cli === '4.0.0';
  const valueOptions = {
    ...(cli4 ? CLI_4_VALUE_OPTIONS : VALUE_OPTIONS),
    // nuxi 3.7.0 and 3.7.1 give `port` no `-p` alias, and never read `-p`
    ...(cli === '3.7.0' || cli === '3.7.1' ? { port: [], p: [] } : {}),
  };
  // As citty passes them to `util.parseArgs`, which reads any other option as
  // a flag
  const parseOptions = Object.fromEntries(
    Object.entries(valueOptions).flatMap(([name, aliases]) => {
      const short = [name, ...aliases].find((alias) => alias.length === 1);
      const multiple = cli4 && CLI_4_MULTIPLE.includes(name);
      return [
        [name, { type: 'string' as const, multiple, ...(short && { short }) }],
        ...aliases.map((alias) => [alias, { type: 'string' as const }]),
      ];
    })
  );
  const { values, positionals } = parseArgs({
    args: getForwardedArgs(options),
    options: parseOptions,
    allowPositionals: true,
    strict: false,
  });
  // The values of an option, where one given no value is `true`
  const read = (name: string) => {
    for (const n of [name, ...valueOptions[name]]) {
      const value = values[n];
      if (value !== undefined) return [value].flat();
    }
  };
  // citty makes `true` '' for an option it types as a string
  const readStrings = (name: string) =>
    read(name)?.map((value) => (value === true ? '' : String(value)));
  const readString = (name: string) => readStrings(name)?.at(-1);
  return {
    port: readString('port'),
    // Typed as a string from @nuxt/cli 4
    host: !cli4 && read('host')?.at(-1) === true ? true : readString('host'),
    cwd: readString('cwd'),
    rootDir: positionals[0],
    dotenv: cli4 ? readStrings('dotenv') : readString('dotenv'),
    envName: readString('envName'),
    extends: cli4 ? readStrings('extends') : readString('extends'),
  };
}

/**
 * The readyWhen of the inferred serve target when the config doesn't load the
 * ready-signal module. Runs in the env and with the options of the task,
 * resolves the address the way `nuxt dev` does, and waits until it serves the
 * app there.
 */
export async function waitForNuxtDevServer() {
  await runReadyCheck(async ({ options, root }) => {
    const cli = getCliRange(root);
    const args = parseNuxtDevArgs(options, cli);
    const envBeforeDotenv = { ...process.env };
    // `nuxt dev` forces it, and c12 reads it as the default --envName
    process.env.NODE_ENV = 'development';
    // --cwd from nuxi 3.7, --envName from 3.15 and --extends from 3.26
    const cwd = resolve((gte(cli, '3.7.0') && args.cwd) || args.rootDir || '.');
    const { loadNuxtConfig } = await loadNuxtKitDynamicImport();
    const nuxtOptions = await loadNuxtConfig({
      cwd,
      envName: gte(cli, '3.15.0') ? args.envName : undefined,
      dotenv: { cwd, fileName: args.dotenv },
      overrides: {
        dev: true,
        extends: gte(cli, '3.26.0') ? args.extends : undefined,
      },
    });
    const address = getListenAddress(cli, args, envBeforeDotenv, nuxtOptions);
    if (address) {
      await waitUntilServing(getServerUrls(address));
    }
    // Waited for above, as `nuxt dev` takes the port before it serves the app
    return null;
  });
}

// The CLI `nuxt dev` runs: the one the nearest node_modules/.bin/nuxt links
// to, else nuxt's own: nuxi before Nuxt 3.15.2, and @nuxt/cli from it
function getCliRange(root: string): CliRange {
  let cliVersion = getLinkedCliVersion(root);
  if (cliVersion === undefined) {
    let nuxt: ReturnType<typeof readModulePackageJson>;
    try {
      nuxt = readModulePackageJson('nuxt', [root]);
    } catch {
      // Nothing to match, so match the CLI a new project gets
      return '4.0.0';
    }
    const cli = nuxt.packageJson.dependencies?.nuxi ? 'nuxi' : '@nuxt/cli';
    cliVersion = getInstalledPackageVersion(cli, [dirname(nuxt.path)]);
  }
  const version = valid(cliVersion);
  // Without a 3.x or later version to match, resolve as the latest 3.x CLIs do
  return (
    (version && CLI_RANGES.find((start) => gte(version, start))) || '3.31.0'
  );
}

// The version of the nuxi or @nuxt/cli that the first node_modules/.bin/nuxt
// from `root` up links to, as run-commands puts those dirs first on the PATH
function getLinkedCliVersion(root: string): string | undefined {
  for (let dir = root; ; dir = dirname(dir)) {
    const bin = join(dir, 'node_modules', '.bin', 'nuxt');
    if (existsSync(bin)) {
      if (!lstatSync(bin).isSymbolicLink()) return undefined;
      let packageRoot = dirname(realpathSync(bin));
      while (!existsSync(join(packageRoot, 'package.json'))) {
        if (dirname(packageRoot) === packageRoot) return undefined;
        packageRoot = dirname(packageRoot);
      }
      const { name, version } = readJsonFile(join(packageRoot, 'package.json'));
      return name === 'nuxi' || name === '@nuxt/cli' ? version : undefined;
    }
    if (dirname(dir) === dir) return undefined;
  }
}

// The CLIs before 3.30 read the env once they have loaded .env, which loading
// the config does here too
function getListenAddress(
  cli: CliRange,
  args: NuxtDevArgs,
  envBeforeDotenv: NodeJS.ProcessEnv,
  nuxtOptions: LoadedNuxtConfig
): ServerAddress | null {
  const env = process.env;
  const config = nuxtOptions.devServer;
  // The root config as written, without its layers or the schema defaults
  const rootLayer = nuxtOptions._layers?.[0]?.config;
  // get-port-please skips a PORT that isn't a number
  const envPort = Number.parseInt(env.PORT ?? '') || undefined;
  switch (cli) {
    case '3.0.0':
      return getServerAddress(
        // get-port-please takes PORT over the port nuxi passes it
        envPort || args.port || env.NUXT_PORT || 3000,
        args.host || env.NUXT_HOST || env.HOST
      );
    case '3.1.1':
      return getServerAddress(
        args.port || env.NUXT_PORT || envPort || 3000,
        args.host || env.NUXT_HOST || env.HOST
      );
    case '3.2.1':
      return getServerAddress(
        args.port || env.NUXT_PORT || config.port,
        args.host || env.NUXT_HOST || config.host
      );
    case '3.6.2':
      return getServerAddress(
        args.port || env.NUXT_PORT || env.NITRO_PORT || config.port,
        args.host || env.NUXT_HOST || env.NITRO_HOST || config.host
      );
    case '3.7.0':
      return getServerAddress(
        args.port || env.NUXT_PORT || env.NITRO_PORT || env.PORT || config.port,
        // Its listhen reads the --host arg, not the host nuxi resolves
        args.host ?? env.HOST
      );
    case '3.7.1':
    case '3.7.2': {
      // Without a root layer, they read the resolved config
      const { port, host }: DevServerConfig =
        (rootLayer ?? nuxtOptions).devServer ?? {};
      return getServerAddress(
        args.port ??
          env.NUXT_PORT ??
          env.NITRO_PORT ??
          env.PORT ??
          port ??
          // get-port-please's own default
          3000,
        args.host ?? env.NUXT_HOST ?? env.NITRO_HOST ?? env.HOST ?? host
      );
    }
    case '3.8.4':
    case '3.15.0':
      return getServerAddress(
        args.port ?? env.NUXT_PORT ?? env.NITRO_PORT ?? env.PORT ?? config.port,
        args.host ??
          env.NUXT_HOST ??
          env.NITRO_HOST ??
          env.HOST ??
          rootLayer?.devServer?.host
      );
    case '3.25.0':
    case '3.26.0':
      return getServerAddress(
        args.port ?? env.NUXT_PORT ?? env.NITRO_PORT ?? env.PORT ?? config.port,
        args.host ?? env.NUXT_HOST ?? env.NITRO_HOST ?? env.HOST ?? config.host
      );
    case '3.30.0':
      if (envBeforeDotenv._PORT) {
        return getServerAddress(envBeforeDotenv._PORT, '127.0.0.1');
      }
      return getServerAddress(
        args.port ?? config.port,
        args.host ?? config.host
      );
    case '3.31.0': {
      const {
        _PORT,
        NUXT_PORT,
        NITRO_PORT,
        PORT,
        NUXT_HOST,
        NITRO_HOST,
        HOST,
      } = envBeforeDotenv;
      if (_PORT) {
        return getServerAddress(_PORT, '127.0.0.1');
      }
      return getServerAddress(
        (args.port || NUXT_PORT || NITRO_PORT || PORT) ?? config.port,
        (args.host || NUXT_HOST || NITRO_HOST || HOST) ?? config.host
      );
    }
    case '4.0.0': {
      const { NUXT_PORT, NITRO_PORT, PORT, NUXT_HOST, NITRO_HOST, HOST } =
        envBeforeDotenv;
      return getServerAddress(
        args.port || NUXT_PORT || NITRO_PORT || PORT || config.port,
        args.host ?? (NUXT_HOST || NITRO_HOST || HOST) ?? config.host
      );
    }
    default: {
      const unhandled: never = cli;
      throw new Error(`Unhandled \`nuxt dev\` CLI range: ${unhandled}`);
    }
  }
}

// In both schemes, since the wrong one gets no answer, and on both loopback
// addresses when the host is a wildcard or localhost
function getServerUrls({ port, host }: ServerAddress): string[] {
  return (host ? [host] : ['127.0.0.1', '::1']).flatMap((h) => {
    const authority = `${h.includes(':') ? `[${h}]` : h}:${port}`;
    return [`http://${authority}/`, `https://${authority}/`];
  });
}
