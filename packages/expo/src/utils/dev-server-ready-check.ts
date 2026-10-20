import {
  getForwardedArgs,
  getServerAddress,
  readModulePackageJson,
  runReadyCheck,
} from '@nx/devkit/internal';
import { dirname, resolve } from 'path';

export interface ExpoStartFlags {
  port?: number;
  dev: boolean;
  projectRoot?: string;
}

// The `expo start` options that take a value. The others are booleans.
const VALUE_OPTIONS = new Set([
  '--max-workers',
  '--private-key-path',
  '--port',
  '-p',
  '--scheme',
  '--host',
  '-m',
]);

/**
 * The flags `expo start` gets from the task's options, as run-commands
 * forwards them. Ports how the `arg` parser of @expo/cli reads them.
 */
export function parseExpoStartFlags(
  options: Record<string, unknown>
): ExpoStartFlags {
  const args = getForwardedArgs(options);
  // `expo` drops the first `--` before `expo start` parses the args
  const separator = args.indexOf('--');
  if (separator !== -1) args.splice(separator, 1);

  const flags: ExpoStartFlags = { dev: true };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') {
      flags.projectRoot ??= args[i + 1];
      break;
    }
    if (arg.length < 2 || !arg.startsWith('-')) {
      flags.projectRoot ??= arg;
      continue;
    }
    // `-cp` is `-c -p`, and only its last option can take a value
    const [name, value] = arg.startsWith('--')
      ? arg.split(/=(.*)/, 2)
      : [`-${arg.at(-1)}`];
    if (name === '--no-dev') {
      flags.dev = false;
    } else if (VALUE_OPTIONS.has(name)) {
      const optionValue = value ?? args[++i];
      if (name === '--port' || name === '-p') {
        flags.port = Number(optionValue);
      }
    }
  }
  return flags;
}

/** The Metro port `expo start` uses when no `--port` is given. */
export function getMetroPort(rctMetroPort: string | undefined): number {
  // Expo falls back to 8081 on an RCT_METRO_PORT of 0 too
  return Number.parseInt(rctMetroPort, 10) || 8081;
}

/**
 * The readyWhen of the inferred `expo start` targets. Runs in the env and with
 * the options of the task, resolves the Metro port the way `expo start` does,
 * and waits for it.
 */
export async function waitForExpoDevServer() {
  await runReadyCheck(async ({ options, root }) => {
    const flags = parseExpoStartFlags(options);
    const port =
      flags.port ??
      getMetroPort(
        process.env.RCT_METRO_PORT ??
          readDotEnv(resolve(root, flags.projectRoot ?? '.'), flags.dev)
            .RCT_METRO_PORT
      );
    // --host picks the URL type (lan, tunnel, localhost), and Metro accepts
    // loopback connections for each
    const address = getServerAddress(port, undefined);
    return address ? [address] : null;
  });
}

/**
 * The variables `expo start` loads from the project's .env files, read with
 * the @expo/env of the @expo/cli that `expo` runs.
 */
function readDotEnv(projectRoot: string, dev: boolean): Record<string, string> {
  const expo = dirname(readModulePackageJson('expo', [projectRoot]).path);
  const cli = dirname(readModulePackageJson('@expo/cli', [expo]).path);
  const { parseProjectEnv } = require(
    require.resolve('@expo/env', { paths: [cli] })
  );
  return parseProjectEnv(projectRoot, {
    // `expo start` sets NODE_ENV this way before it loads the files
    mode: process.env.NODE_ENV || (dev ? 'development' : 'production'),
    silent: true,
  }).env;
}
