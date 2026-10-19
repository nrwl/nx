import { createConnection, type AddressInfo } from 'net';
import {
  interpolateArgsIntoCommand,
  normalizeRunCommandsArgs,
} from 'nx/src/devkit-internals';
import { resolve } from 'path';
import { splitShellArgs } from './split-shell-args';

/**
 * The url of a server listening on `address`, for `emitReadySignal`. A
 * wildcard address maps to localhost. Undefined for a socket or a pipe.
 */
export function getListeningUrl(
  address: AddressInfo | string | null | undefined,
  https: boolean
): string | undefined {
  if (!address || typeof address === 'string') {
    return undefined;
  }
  const host =
    address.address === '::' || address.address === '0.0.0.0'
      ? 'localhost'
      : address.family === 'IPv6'
        ? `[${address.address}]`
        : address.address;
  return `${https ? 'https' : 'http'}://${host}:${address.port}/`;
}

/**
 * A `readyWhen` that calls `waitForDevServer` from `module` when the task
 * runs, with the config's file name, when given, and then `literals` as its
 * arguments.
 */
export function getReadyCheckReadyWhen(
  module: string,
  configFileName?: string,
  ...literals: string[]
): { command: string; interval: number } {
  // Unquoted in the command, as no quoting works in every shell
  if (configFileName !== undefined && !/^[\w.-]+$/.test(configFileName)) {
    throw new Error(`Unsupported config file name: ${configFileName}`);
  }
  const args = [
    ...(configFileName === undefined ? [] : ['process.argv[1]']),
    ...literals.map((literal) => `'${literal}'`),
  ].join(', ');
  return {
    command: `node -e "require('${module}').waitForDevServer(${args})"${
      configFileName === undefined ? '' : ` ${configFileName}`
    }`,
    // Each attempt starts node, and loads the config when there is one
    interval: 1000,
  };
}

export type TaskOptions = Record<string, unknown> & { cwd?: string };

/**
 * The arguments run-commands passes the task's command, as the command
 * receives them: built by run-commands' own code, then split the way the shell
 * splits them. A `{args.*}` command gets them as if appended, which matches a
 * command that passes each value to the flag of its name.
 */
export function getForwardedArgs(options: TaskOptions): string[] {
  const commands = options.command
    ? [{ command: [options.command].flat().join(' ') }]
    : Array.isArray(options.commands)
      ? options.commands.map((c) =>
          typeof c === 'string' ? { command: c } : c
        )
      : [];
  // Which of several commands starts the server is unknown
  const server: { command?: string; forwardAllArgs?: boolean } =
    commands.length === 1 ? commands[0] : {};
  const template =
    server.command?.includes('{args}') && !server.command.includes('{args.')
      ? '{args}'
      : '';
  const forwarded = interpolateArgsIntoCommand(
    template,
    normalizeRunCommandsArgs({
      ...options,
      __unparsed__: Array.isArray(options.__unparsed__)
        ? options.__unparsed__.map(String)
        : [],
    }),
    server.forwardAllArgs ?? (options.forwardAllArgs as boolean) ?? true
  );
  return splitShellArgs(forwarded);
}

export interface CacArgsOptions {
  /** Each short flag and the camel-case option it aliases, such as `{ c: 'config' }`. */
  aliases?: Record<string, string>;
  /** The flags that take no value, by any of their names. */
  booleans?: string[];
}

/**
 * The options a cac CLI, such as Rsbuild's or Rspack's, parses from `args`,
 * before it applies option defaults and types. Ports cac's `mri()` step:
 * - A flag takes the next argument as its value unless that starts with `-`.
 * - A repeated flag collects its values in an array, and numeric values
 *   become numbers.
 * - Every alias takes the value of the alias given first.
 * - The kebab-case and camel-case spellings of an option take the value of
 *   the spelling that first appears last.
 *
 * Dotted names stay flat keys, where cac nests them.
 */
export function parseCacArgs(
  args: string[],
  { aliases = {}, booleans = [] }: CacArgsOptions = {}
): Record<string, unknown> {
  const aliasOf = new Map<string, string>();
  for (const [short, long] of Object.entries(aliases)) {
    aliasOf.set(short, long).set(long, short);
  }
  const isBoolean = (name: string) =>
    booleans.includes(name) || booleans.includes(aliasOf.get(name));
  const parsed: Record<string, unknown> = {};
  const add = (name: string, value: string | boolean) => {
    const number = Number(value);
    const typed =
      typeof value === 'boolean'
        ? value
        : isBoolean(name)
          ? value !== 'false' && value !== ''
          : Number.isFinite(number)
            ? number
            : value;
    parsed[name] =
      parsed[name] === undefined ? typed : [parsed[name], typed].flat();
  };

  let i = 0;
  for (; i < args.length && args[i] !== '--'; i++) {
    const arg = args[i];
    const dashes = arg.match(/^-*/)[0].length;
    if (dashes === 0) continue;
    if (arg.startsWith('no-', dashes)) {
      parsed[arg.slice(dashes + 3)] = false;
      continue;
    }
    const equals = arg.indexOf('=', dashes + 1);
    const name = arg.slice(dashes, equals === -1 ? undefined : equals);
    const value =
      (equals === -1 ? '' : arg.slice(equals + 1)) ||
      i + 1 === args.length ||
      args[i + 1].startsWith('-') ||
      args[++i];
    // `-abc` sets `a` and `b` and gives its value to `c`
    const names = dashes === 2 ? [name] : [...name];
    names.forEach((n, index) => add(n, index + 1 < names.length || value));
  }

  const synced = new Set<string>();
  for (const name of Object.keys(parsed)) {
    const alias = aliasOf.get(name);
    if (alias !== undefined && !synced.has(name)) {
      parsed[alias] = parsed[name];
      synced.add(alias);
    }
  }
  const options: Record<string, unknown> = { '--': args.slice(i + 1) };
  for (const [name, value] of Object.entries(parsed)) {
    options[
      name.replace(/([a-z])-([a-z])/g, (_, a, b) => a + b.toUpperCase())
    ] = value;
  }
  return options;
}

/**
 * The options a commander 12 command, such as the Rsbuild 1.0 and 1.1 CLI's,
 * parses from `args`, by attribute name, given its option flags such as
 * `'-o --open [url]'`. The last value of an option wins, and no defaults or
 * custom argument parsers apply. Throws where the command exits instead: on an
 * unknown option, `--help` included, or a missing value.
 */
export function parseCommanderArgs(
  args: string[],
  declarations: string[]
): Record<string, string | true> {
  const options = declarations.map((flags) => {
    const names = flags.split(/[ |,]+/).filter((part) => part.startsWith('-'));
    return {
      flags,
      names,
      key: names
        .at(-1)
        .replace(/^-+/, '')
        .split('-')
        .reduce((key, word) => key + word[0].toUpperCase() + word.slice(1)),
      required: flags.includes('<'),
      optional: flags.includes('['),
    };
  });
  const find = (flag: string) => options.find((o) => o.names.includes(flag));
  const isOption = (arg: string) => arg.length > 1 && arg[0] === '-';
  const parsed: Record<string, string | true> = {};

  const rest = [...args];
  while (rest.length > 0 && rest[0] !== '--') {
    const arg = rest.shift();
    let option = find(arg);
    if (option?.required) {
      if (rest.length === 0) {
        throw new Error(`option '${option.flags}' argument missing`);
      }
      parsed[option.key] = rest.shift();
    } else if (option) {
      parsed[option.key] =
        option.optional && rest.length > 0 && !isOption(rest[0])
          ? rest.shift()
          : true;
    } else if (
      arg.length > 2 &&
      arg[0] === '-' &&
      arg[1] !== '-' &&
      (option = find(arg.slice(0, 2)))
    ) {
      // `-abc` gives `a` the value `bc`, or sets it and goes on with `-bc`
      if (option.required || option.optional) {
        parsed[option.key] = arg.slice(2);
      } else {
        parsed[option.key] = true;
        rest.unshift(`-${arg.slice(2)}`);
      }
    } else if (
      /^--[^=]+=/.test(arg) &&
      (option = find(arg.slice(0, arg.indexOf('=')))) &&
      (option.required || option.optional)
    ) {
      parsed[option.key] = arg.slice(arg.indexOf('=') + 1);
    } else if (isOption(arg)) {
      throw new Error(`unknown option '${arg}'`);
    }
  }
  return parsed;
}

export interface ServerAddress {
  port: number;
  host?: string;
}

// The probe reaches these on loopback
const LOOPBACK_HOSTS = new Set(['', 'localhost', '0.0.0.0', '::']);

/**
 * Where to probe a server, or null when its port is not a positive integer:
 * a server that picks its port or listens on a socket can't be probed ahead.
 */
export function getServerAddress(
  port: unknown,
  host: unknown
): ServerAddress | null {
  const number = Number(port);
  if (!Number.isInteger(number) || number <= 0) return null;
  return typeof host === 'string' && !LOOPBACK_HOSTS.has(host)
    ? { port: number, host }
    : { port: number };
}

/**
 * Runs a task-time readiness check. Reads the options the task runs with,
 * moves to its cwd, where the CLI resolves its config, and waits until every
 * address `resolveAddresses` returns accepts a TCP connection. Probes nothing
 * when it returns null.
 */
export async function runReadyCheck(
  resolveAddresses: (task: {
    options: TaskOptions;
    root: string;
  }) => Promise<ServerAddress[] | null>
): Promise<void> {
  const options = readTaskOptions();
  const root = resolve(options.cwd ?? '.');
  process.chdir(root);
  const addresses = await resolveAddresses({ options, root });
  if (addresses) {
    await Promise.all(addresses.map(waitForAddress));
  }
}

function readTaskOptions(): TaskOptions {
  try {
    return JSON.parse(process.env.NX_TASK_OPTIONS ?? '{}');
  } catch {
    return {};
  }
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
