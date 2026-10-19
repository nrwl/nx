import { splitShellArgs } from '@nx/devkit/internal';
import { createConnection } from 'net';
import { dirname, resolve } from 'path';
import { loadViteDynamicImport } from './executor-utils';

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
 * The flags `vite` and `vite preview` get from the target's options, in the
 * order run-commands passes them: named options, `args`, then overrides.
 */
export function parseViteFlags(
  options: Record<string, unknown>,
  command: 'serve' | 'preview'
): ViteFlags {
  const args = Array.isArray(options.args)
    ? options.args.join(' ')
    : typeof options.args === 'string'
      ? options.args
      : '';
  const unparsed = Array.isArray(options.__unparsed__)
    ? options.__unparsed__.map(String)
    : [];
  // run-commands skips a named option the overrides set, or that args set to
  // another value, parsing both with nx's yargs-parser
  const yargsParser: (
    args: string | string[],
    opts: { configuration: Record<string, boolean> }
  ) => Record<string, unknown> = require(
    require.resolve('yargs-parser', {
      paths: [dirname(require.resolve('nx/package.json'))],
    })
  );
  const overrides = yargsParser(unparsed, {
    configuration: {
      'parse-numbers': false,
      'parse-positional-numbers': false,
      'dot-notation': false,
      'camel-case-expansion': false,
    },
  });
  const fromArgs = args
    ? yargsParser(args.replace(/(^"|"$)/g, ''), {
        configuration: { 'camel-case-expansion': true },
      })
    : {};
  const named = Object.keys(options)
    .filter(
      (k) =>
        ['port', 'host', 'mode', 'm', 'config', 'c'].includes(k) &&
        typeof options[k] !== 'object' &&
        overrides[k] === undefined &&
        (!Object.hasOwn(fromArgs, k) || fromArgs[k] === options[k])
    )
    .map((k) => `--${k}=${options[k]}`);
  const { values, positionals } = parseArgv(
    [...named, ...splitShellArgs(args), ...unparsed],
    BOOLEAN_OPTIONS[command]
  );
  // Vite keeps the values of whichever spelling of an option comes first
  const last = (...names: string[]) =>
    values.get([...values.keys()].find((k) => names.includes(k)))?.at(-1);
  const asString = (value: string | boolean) =>
    typeof value === 'string' ? value : undefined;
  return {
    port: asString(last('port')),
    host: last('host'),
    mode: asString(last('m', 'mode')),
    config: asString(last('c', 'config')),
    root: positionals[0],
  };
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

export type ServerAddress = { port: number; host?: string };

// Vite's default ports: https://vite.dev/config/server-options#server-port
const DEFAULT_PORT = { serve: 5173, preview: 4173 };

export function getViteServerAddress(
  server: { port?: unknown; host?: unknown } | undefined,
  flags: ViteFlags,
  command: 'serve' | 'preview'
): ServerAddress | null {
  const port = Number(flags.port ?? server?.port ?? DEFAULT_PORT[command]);
  if (!Number.isInteger(port) || port <= 0) return null;
  const host = flags.host ?? server?.host;
  // `true` and the wildcards listen on every address, loopback included
  return typeof host === 'string' &&
    !['localhost', '0.0.0.0', '::'].includes(host)
    ? { port, host }
    : { port };
}

/**
 * The readyWhen of the inferred serve and preview targets when the config
 * doesn't load the signal plugin. Runs in the env and with the options of the
 * task, resolves the config the way `vite` does, and waits for the server's
 * port.
 */
export async function waitForViteServer(
  configPath: string,
  command: 'serve' | 'preview'
) {
  let options: Record<string, unknown> & { cwd?: string } = {};
  try {
    options = JSON.parse(process.env.NX_TASK_OPTIONS ?? '{}');
  } catch {}
  const flags = parseViteFlags(options, command);
  process.chdir(resolve(options.cwd ?? '.'));

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
  if (address) await waitForAddress(address);
}

async function waitForAddress({ port, host }: ServerAddress) {
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
