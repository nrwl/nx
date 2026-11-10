import {
  getForwardedArgs,
  getServerAddress,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';
import { loadViteDynamicImport } from './executor-utils';

// `react-router dev` runs a Vite dev server, with its own CLI
export type ViteCommand = 'serve' | 'preview' | 'react-router-dev';

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
 * The flags `vite`, `vite preview` and `react-router dev` get from the task's
 * options, as run-commands forwards them.
 */
export function parseViteFlags(
  options: Record<string, unknown>,
  command: ViteCommand
): ViteFlags {
  const args = getForwardedArgs(options);
  if (command === 'react-router-dev') {
    return parseReactRouterDevFlags(args);
  }
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

// The options of `react-router dev` that take no value
const REACT_ROUTER_BOOLEAN_OPTIONS = [
  'clearScreen',
  'cors',
  'emptyOutDir',
  'force',
  'help',
  'json',
  'no-typescript',
  'profile',
  'strictPort',
  'typescript',
  'version',
  'watch',
];
// Options that take no value when the arg after their first use is missing
// or another option
const REACT_ROUTER_OPTIONAL_VALUE_OPTIONS = [
  'host',
  'open',
  'sourcemapClient',
  'sourcemapServer',
];
const REACT_ROUTER_SHORT_OPTIONS: Record<string, string> = {
  c: 'config',
  h: 'help',
  l: 'logLevel',
  m: 'mode',
  p: 'port',
  v: 'version',
};

/**
 * Parses args like `react-router dev`: an option keeps its last value across
 * its spellings.
 */
function parseReactRouterDevFlags(args: string[]): ViteFlags {
  // The CLI's argv starts with `dev`, which its value check reads for an
  // option given only as `--name=value`
  const argv = ['dev', ...args];
  const takesNoValue = (name: string) => {
    if (REACT_ROUTER_BOOLEAN_OPTIONS.includes(name)) return true;
    if (!REACT_ROUTER_OPTIONAL_VALUE_OPTIONS.includes(name)) return false;
    const next = argv[argv.indexOf(`--${name}`) + 1];
    return !next || next.startsWith('-');
  };
  const values = new Map<string, string | boolean>();
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.length < 2 || !arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }
    const long = arg.startsWith('--');
    const eq = long ? arg.indexOf('=') : -1;
    const name = long
      ? arg.slice(2, eq === -1 ? undefined : eq)
      : (REACT_ROUTER_SHORT_OPTIONS[arg[1]] ?? arg[1]);
    if (takesNoValue(name)) {
      values.set(name, true);
    } else if (eq !== -1) {
      values.set(name, arg.slice(eq + 1));
    } else {
      // `-p4000` is port 4000
      values.set(name, arg.length > 2 && !long ? arg.slice(2) : argv[++i]);
    }
  }
  return {
    port: asString(values.get('port')),
    host: values.get('host'),
    mode: asString(values.get('mode')),
    config: asString(values.get('config')),
    root: positionals[1],
  };
}

const SERVER_OF_COMMAND: Record<ViteCommand, 'serve' | 'preview'> = {
  serve: 'serve',
  preview: 'preview',
  'react-router-dev': 'serve',
};

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
 * The readyWhen of the inferred serve and preview targets whose config doesn't
 * load the signal plugin, and of the React Router dev target. Runs in the env
 * and with the options of the task, resolves the config the way `vite` does,
 * and waits for the server's port.
 */
export async function waitForViteServer(
  configPath: string,
  command: ViteCommand
) {
  const server = SERVER_OF_COMMAND[command];
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
      server === 'preview'
        ? await resolveConfig(
            inlineConfig,
            'serve',
            'production',
            'production',
            true
          )
        : await resolveConfig(inlineConfig, 'serve');
    const address = getViteServerAddress(
      server === 'preview'
        ? { ...config.preview, host: config.preview.host ?? config.server.host }
        : config.server,
      flags,
      server
    );
    return address ? [address] : null;
  });
}
