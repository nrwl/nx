import {
  getForwardedArgs,
  getServerAddress,
  parseCacArgs,
  parseCommanderArgs,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';
import { resolve } from 'path';
import { lt, major } from 'semver';

/** The options the Rsbuild CLI reads, typed as its parsers may set them. */
export interface RsbuildFlags {
  port?: unknown;
  host?: unknown;
  envMode?: string;
  envDir?: string;
  config?: string;
  configLoader?: string;
  root?: string;
  env?: boolean;
}

const COMMANDER_OPTIONS = [
  '-c --config <config>',
  '-r --root <root>',
  '-m --mode <mode>',
  '--env-mode <mode>',
  '--environment <name>',
  '--env-dir <dir>',
  '-o --open [url]',
  '--port <port>',
  '--host <host>',
];

/**
 * The flags `rsbuild dev` and `rsbuild preview` of Rsbuild `version` get from
 * the task's options, as run-commands forwards them, read the way that CLI
 * reads them.
 */
export function parseRsbuildFlags(
  options: Record<string, unknown>,
  version: string
): RsbuildFlags {
  const args = getForwardedArgs(options);
  // cac replaced commander in 1.2.0-alpha.0
  const parsed = lt(version, '1.2.0-alpha.0')
    ? parseCommanderArgs(args, COMMANDER_OPTIONS)
    : parseCacArgs(args, {
        aliases: { c: 'config', m: 'mode', o: 'open', r: 'root' },
        booleans: ['env'],
      });
  const { port, host, envMode, envDir, config, configLoader, root, env } =
    parsed as RsbuildFlags;
  return {
    port,
    // 1.x applies the host only when it is truthy
    host: major(version) === 1 ? host || undefined : host,
    envMode,
    envDir,
    config,
    configLoader,
    root,
    // 1.3.3 added --no-env
    env: lt(version, '1.3.3') ? undefined : env,
  };
}

export function getRsbuildServerAddress(server: {
  port?: unknown;
  host?: unknown;
}): ServerAddress | null {
  return getServerAddress(server.port, server.host);
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
  await runReadyCheck(async ({ options, root: cwd }) => {
    const { createRsbuild, loadConfig, loadEnv, version } =
      require('@rsbuild/core') as typeof import('@rsbuild/core');
    const flags = parseRsbuildFlags(options, version);
    const root = flags.root ? resolve(cwd, flags.root) : cwd;
    // The CLI sets NODE_ENV first, then loads the env files for that mode and
    // the config, whose function form reads the command from argv
    process.env.NODE_ENV ||= command === 'dev' ? 'development' : 'production';
    const envs =
      flags.env === false
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
    if (flags.host !== undefined) config.server.host = flags.host as string;
    if (flags.port) config.server.port = flags.port as number;

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
    return address ? [address] : null;
  });
}
