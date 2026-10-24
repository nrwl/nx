import {
  getForwardedArgs,
  getInstalledPackageVersion,
  getServerAddress,
  runReadyCheck,
} from '@nx/devkit/internal';
import { lt } from 'semver';

// Commander gives these the next arg even when it starts with `-`
const REQUIRED_VALUE_FLAGS = new Set([
  '-p',
  '--port',
  '-h',
  '--host',
  '-c',
  '--config-dir',
  '--ssl-ca',
  '--ssl-cert',
  '--ssl-key',
  '--preview-url',
  '--loglevel',
]);

interface DevFlags {
  port?: string;
  host?: string;
}

/**
 * The `--port` and `--host` that `storybook dev` gets from the task's options,
 * parsed the way its commander CLI parses them.
 */
function parseDevFlags(options: Record<string, unknown>): DevFlags {
  const args = getForwardedArgs(options);
  const flags: DevFlags = {};
  for (let i = 0; i < args.length && args[i] !== '--'; i++) {
    const arg = args[i];
    let flag: string;
    let value: string | undefined;
    if (REQUIRED_VALUE_FLAGS.has(arg)) {
      flag = arg;
      value = args[++i];
    } else if (
      /^-[^-]./.test(arg) &&
      REQUIRED_VALUE_FLAGS.has(arg.slice(0, 2))
    ) {
      flag = arg.slice(0, 2);
      value = arg.slice(2);
    } else if (/^--[^=]+=/.test(arg)) {
      const equals = arg.indexOf('=');
      flag = arg.slice(0, equals);
      value = arg.slice(equals + 1);
    } else {
      continue;
    }
    if (flag === '-p' || flag === '--port') flags.port = value;
    else if (flag === '-h' || flag === '--host') flags.host = value;
  }
  return flags;
}

/** The port the `storybook dev` of `version` asks for, as its CLI resolves it. */
function resolvePort(
  flag: string | undefined,
  env: NodeJS.ProcessEnv,
  version: string | null
): number | string | undefined {
  if (version && lt(version, '10.5.0')) {
    // A set SBCONFIG_PORT replaces the flag
    const port = env.SBCONFIG_PORT || flag;
    return port === undefined ? undefined : parseInt(port, 10);
  }
  const claudePreview = !!env.CLAUDE_AGENT_SDK_VERSION && !env.AI_AGENT;
  return claudePreview
    ? (env.PORT ?? flag ?? env.SBCONFIG_PORT)
    : (flag ?? env.SBCONFIG_PORT ?? env.PORT);
}

/**
 * The readyWhen of the inferred `storybook dev` target. Runs in the env and
 * with the options of the task, resolves the port the way the task's Storybook
 * does, and waits for it. Probes nothing when no port is set, since Storybook
 * then listens on a free port it picks.
 */
export async function waitForStorybookDevServer() {
  await runReadyCheck(async ({ options, root }) => {
    const flags = parseDevFlags(options);
    const env = process.env;
    const address = getServerAddress(
      resolvePort(
        flags.port,
        env,
        getInstalledPackageVersion('storybook', [root])
      ),
      env.SBCONFIG_HOSTNAME || flags.host
    );
    return address ? [address] : null;
  });
}

/**
 * The readyWhen of `@storybook/angular:start-storybook` targets, which report
 * no URL to signal. As in the builder, a non-empty SBCONFIG_PORT or
 * SBCONFIG_HOSTNAME replaces the option, and 9009 and localhost are defaults.
 */
export function getStartStorybookReadyWhen() {
  return {
    port: '{env.SBCONFIG_PORT ?? options.port ?? 9009}',
    host: '{env.SBCONFIG_HOSTNAME ?? options.host ?? localhost}',
  };
}
