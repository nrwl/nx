import {
  getForwardedArgs,
  getServerAddress,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';
import { loadViteDynamicImport } from './executor-utils';

export type ViteCommand = 'serve' | 'preview';

export interface ViteFlags {
  port?: string;
  host?: string | boolean;
  mode?: string;
  config?: string;
  root?: string;
}

// Vite's boolean options: the arg after one is positional, not its value
const GLOBAL_BOOLEAN_OPTIONS = ['clearScreen', 'h', 'help', 'v', 'version'];
const BOOLEAN_OPTIONS = {
  serve: [
    ...GLOBAL_BOOLEAN_OPTIONS,
    'cors',
    'strictPort',
    'force',
    'experimentalBundle',
  ],
  preview: [...GLOBAL_BOOLEAN_OPTIONS, 'strictPort'],
};

/**
 * The flags `vite` and `vite preview` get from the task's options, as
 * run-commands forwards them.
 */
export function parseViteFlags(
  options: Record<string, unknown>,
  command: ViteCommand
): ViteFlags {
  const args = getForwardedArgs(options);
  const { values, positionals } = parseArgv(args, BOOLEAN_OPTIONS[command]);
  // Vite keeps the values of whichever spelling of an option comes first
  const last = (...names: string[]) =>
    values.get([...values.keys()].find((k) => names.includes(k)))?.at(-1);
  return {
    port: asString(last('port')),
    host: last('host'),
    mode: asString(last('m', 'mode')),
    config: asString(last('c', 'config')),
    root: positionals[0],
  };
}

function asString(value: string | boolean | undefined) {
  return typeof value === 'string' ? value : undefined;
}

// A port of the mri parser Vite's CLI uses, keeping each option's values
function parseArgv(argv: string[], booleans: string[]) {
  const values = new Map<string, Array<string | boolean>>();
  const positionals: string[] = [];
  const add = (name: string, value: string | boolean) =>
    values.set(name, [...(values.get(name) ?? []), value]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') break;
    const dashes = arg.match(/^-*/)[0].length;
    if (dashes === 0) {
      positionals.push(arg);
      continue;
    }
    if (arg.startsWith('no-', dashes)) {
      add(arg.slice(dashes + 3), false);
      continue;
    }
    const eq = arg.indexOf('=', dashes + 1);
    const name = arg.slice(dashes, eq === -1 ? undefined : eq);
    const value =
      (eq === -1 ? '' : arg.slice(eq + 1)) ||
      i + 1 === argv.length ||
      argv[i + 1].startsWith('-') ||
      argv[++i];
    // `-abc` sets a, b and c, and the value goes to c
    const names = dashes === 2 ? [name] : [...name];
    names.forEach((n, j) => {
      const v = j === names.length - 1 ? value : true;
      if (typeof v === 'string' && booleans.includes(n)) {
        if (v !== 'true' && v !== 'false') positionals.push(v);
        add(n, v !== 'false');
      } else {
        add(n, v);
      }
    });
  }
  return { values, positionals };
}

// Vite's default ports: https://vite.dev/config/server-options#server-port
const DEFAULT_PORT = { serve: 5173, preview: 4173 };

export function getViteServerAddress(
  server: { port?: unknown; host?: unknown } | undefined,
  flags: ViteFlags,
  command: 'serve' | 'preview'
): ServerAddress | null {
  // `true` and the wildcards listen on every address, loopback included
  return getServerAddress(
    flags.port ?? server?.port ?? DEFAULT_PORT[command],
    flags.host ?? server?.host
  );
}

/**
 * The readyWhen of the inferred serve and preview targets when the config
 * doesn't load the signal plugin. Runs in the env and with the options of the
 * task, resolves the config the way `vite` does, and waits for the server's
 * port.
 */
export async function waitForViteServer(
  configPath: string,
  command: ViteCommand
) {
  await runReadyCheck(async ({ options }) => {
    const flags = parseViteFlags(options, command);
    const { resolveConfig } = await loadViteDynamicImport();
    const inlineConfig = {
      root: flags.root,
      // With --root and no --config, Vite finds the config in the root, not in
      // the task's cwd
      configFile: flags.config ?? (flags.root ? undefined : configPath),
      mode: flags.mode,
    };
    // The mode and NODE_ENV defaults of `vite` and `vite preview`
    const config =
      command === 'preview'
        ? await resolveConfig(
            inlineConfig,
            'serve',
            'production',
            'production',
            true
          )
        : await resolveConfig(inlineConfig, 'serve');
    const address = getViteServerAddress(
      command === 'preview'
        ? { ...config.preview, host: config.preview.host ?? config.server.host }
        : config.server,
      flags,
      command
    );
    return address ? [address] : null;
  });
}
