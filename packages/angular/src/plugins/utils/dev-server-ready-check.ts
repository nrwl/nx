import { readJsonFile } from '@nx/devkit';
import {
  getForwardedArgs,
  getInstalledPackageVersion,
  getServerAddress,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';
import { isAbsolute, relative, resolve } from 'node:path';
import { gte } from 'semver';
import type { AngularProjectConfiguration } from '../plugin';

export interface AngularWorkspace {
  projects?: Record<string, AngularProjectConfiguration>;
}

interface NgFlags {
  port?: string | false;
  host?: string | false;
  configuration?: string | false;
  project?: string | false;
}

// The `ng serve` and `ng run` options the check reads, by each of their names
const OPTION_NAMES = new Map<string, keyof NgFlags>([
  ['port', 'port'],
  ['host', 'host'],
  ['configuration', 'configuration'],
  ['c', 'configuration'],
  ['project', 'project'],
]);
const NEGATIVE_NUMBER = /^-([0-9]+(\.[0-9]+)?|\.[0-9]+)$/;
// The `ng serve` options typed as a boolean or an array by the CLI, from the
// dev-server builders' schemas. `inspect` is a boolean only for ssr-dev-server.
const BOOLEAN_OPTIONS = new Set([
  'disable-host-check',
  'force-esbuild',
  'hmr',
  'live-reload',
  'o',
  'open',
  'prebundle',
  'progress',
  'ssl',
  'verbose',
  'watch',
]);
const ARRAY_OPTIONS = new Set(['allowed-hosts', 'define', 'headers']);

/**
 * How many of `rest` yargs-parser gives an option without `=`: a boolean takes
 * only `true` or `false`, and an array every value until the next option, as
 * it also does after an `=` value.
 */
function countValues(
  name: string,
  rest: string[],
  isValue: (arg: string | undefined) => boolean
): number {
  if (BOOLEAN_OPTIONS.has(name)) {
    return /^(true|false)$/.test(rest[0] ?? '') ? 1 : 0;
  }
  if (!ARRAY_OPTIONS.has(name)) return isValue(rest[0]) ? 1 : 0;
  const end = rest.findIndex((arg) => !isLongValue(arg));
  return end === -1 ? rest.length : end;
}

function isLongValue(arg: string | undefined): boolean {
  return (
    arg !== undefined && (!arg.startsWith('-') || NEGATIVE_NUMBER.test(arg))
  );
}

/**
 * The options the Angular CLI parses from `args` that the check reads, and the
 * positional args. Ports the yargs-parser steps that set them, and keeps the
 * last value of a repeated option, as the CLI's middleware does.
 */
function parseNgArgs(args: string[]): {
  flags: NgFlags;
  positionals: string[];
} {
  const flags: NgFlags = {};
  const positionals: string[] = [];
  // Without a value, the string options are empty and the port is unset
  const set = (name: string, value?: string | false) => {
    const key = OPTION_NAMES.get(name);
    if (key) flags[key] = value ?? (key === 'port' ? undefined : '');
  };
  for (let i = 0; i < args.length && args[i] !== '--'; i++) {
    const arg = args[i];
    const next = args[i + 1];
    let match: RegExpMatchArray | null;
    if ((match = arg.match(/^--([^=]+)=([\s\S]*)$/))) {
      set(match[1], match[2]);
      if (ARRAY_OPTIONS.has(match[1])) {
        i += countValues(match[1], args.slice(i + 1), isLongValue);
      }
    } else if ((match = arg.match(/^--no-(.+)$/))) {
      set(match[1], false);
    } else if ((match = arg.match(/^--(.+)$/))) {
      const count = countValues(match[1], args.slice(i + 1), isLongValue);
      set(match[1], count ? next : undefined);
      i += count;
    } else if (/^-[^-]/.test(arg) && !NEGATIVE_NUMBER.test(arg)) {
      // In `-abc`, a letter before `=`, a number or a symbol takes the rest
      // as its value, and the last letter takes the next argument
      const letters = arg.slice(1, -1);
      let broken = false;
      for (let j = 0; j < letters.length; j++) {
        const rest = arg.slice(j + 2);
        if (letters[j + 1] === '=') {
          set(letters[j], arg.slice(j + 3));
        } else if (rest === '-') {
          set(letters[j], rest);
          continue;
        } else if (
          (/[A-Za-z]/.test(letters[j]) &&
            /^-?\d+(\.\d*)?(e-?\d+)?$/.test(rest)) ||
          /\W/.test(letters[j + 1] ?? '')
        ) {
          set(letters[j], rest);
        } else {
          set(letters[j]);
          continue;
        }
        broken = true;
        break;
      }
      const name = arg.at(-1);
      if (broken || name === '-') continue;
      const count = countValues(
        name,
        args.slice(i + 1),
        (value) =>
          value !== undefined &&
          (!/^(-|--)[^-]/.test(value) || NEGATIVE_NUMBER.test(value))
      );
      set(name, count ? next : undefined);
      i += count;
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

function getTargets(project: AngularProjectConfiguration) {
  return project.architect ?? project.targets;
}

/**
 * The project `ng serve` serves when no project is given: the only one with
 * the target, else the one whose root holds the cwd, if no other shares it.
 */
function getDefaultProject(
  projects: Record<string, AngularProjectConfiguration>,
  target: string,
  cwd: string
): string | undefined {
  const names = Object.keys(projects).filter(
    (name) => getTargets(projects[name])?.[target]
  );
  if (names.length < 2) return names[0];
  const containing = Object.entries(projects)
    .filter(([, { root }]) => {
      const path = relative(resolve(cwd, root), cwd);
      return !path.startsWith('..') && !isAbsolute(path);
    })
    .sort(([, a], [, b]) => b.root.length - a.root.length);
  const roots = new Set(containing.map(([, { root }]) => root));
  const project =
    roots.size === containing.length ? containing[0]?.[0] : undefined;
  return names.includes(project) ? project : undefined;
}

const DEFAULT_PORT = 4200;
// The first @angular/build whose dev server reads the PORT env variable
const PORT_ENV_VERSION = '22.0.0-next.1';

/**
 * Where the dev server of the task's `ng serve` or `ng run` command listens,
 * resolved the way the Angular CLI and the target's builder resolve it, or
 * null when nothing can be probed.
 */
export function getDevServerAddress(
  options: Record<string, unknown>,
  workspace: AngularWorkspace,
  root: string
): ServerAddress | null {
  if (typeof options.command !== 'string') return null;
  const [ng, command, ...commandArgs] = options.command.trim().split(/\s+/);
  if (ng !== 'ng' || (command !== 'serve' && command !== 'run')) return null;
  const { flags, positionals } = parseNgArgs([
    ...commandArgs,
    ...getForwardedArgs(options),
  ]);
  const projects = workspace.projects ?? {};
  const [project = '', target = '', configuration] =
    command === 'run'
      ? (commandArgs[0] ?? '').split(':')
      : [
          // The CLI takes the `[project]` positional over `--project`
          positionals[0] ||
            flags.project ||
            getDefaultProject(projects, 'serve', root),
          'serve',
          flags.configuration || undefined,
        ];
  const definition = Object.hasOwn(projects, project)
    ? getTargets(projects[project])?.[target]
    : undefined;
  if (!definition) return null;

  let merged: Record<string, unknown> = { ...definition.options };
  const configurations = configuration || definition.defaultConfiguration;
  for (const name of configurations ? configurations.split(',') : []) {
    merged = { ...merged, ...definition.configurations?.[name.trim()] };
  }
  const port = flags.port ?? merged.port ?? DEFAULT_PORT;
  const host = flags.host ?? merged.host;

  switch (definition.builder) {
    case '@angular/build:dev-server': {
      const version = getInstalledPackageVersion('@angular/build', [root]);
      const envPort = Number(process.env.PORT);
      const readsEnv =
        !!version && gte(version, PORT_ENV_VERSION) && !!process.env.PORT;
      return getServerAddress(
        readsEnv && !isNaN(envPort) ? envPort : port,
        host
      );
    }
    case '@angular-devkit/build-angular:dev-server':
      return getServerAddress(port, host);
    case '@angular-devkit/build-angular:ssr-dev-server':
    case '@nguniversal/builders:ssr-dev-server':
      // browser-sync listens on every interface, whatever the host
      return getServerAddress(port, undefined);
    default:
      return null;
  }
}

/**
 * The readyWhen of the inferred dev server targets. Runs in the env and with
 * the options of the task, resolves the target its `ng` command runs from the
 * workspace config, and waits for the dev server's port.
 */
export async function waitForAngularDevServer(workspaceConfigPath: string) {
  await runReadyCheck(async ({ options, root }) => {
    const workspace = readJsonFile<AngularWorkspace>(
      resolve(root, workspaceConfigPath)
    );
    const address = getDevServerAddress(options, workspace, root);
    return address ? [address] : null;
  });
}
