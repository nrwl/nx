import { ChildProcess, exec, Serializable } from 'child_process';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { env as appendLocalEnv } from 'npm-run-path';
import { ExecutorContext } from '../../config/misc-interfaces';
import * as chalk from 'chalk';
import {
  getPseudoTerminal,
  PseudoTerminal,
  PseudoTtyProcess,
} from '../../tasks-runner/pseudo-terminal';
import { signalToCode } from '../../utils/exit-codes';
import {
  loadAndExpandDotEnvFile,
  unloadDotEnvFile,
} from '../../tasks-runner/task-env';

export const LARGE_BUFFER = 1024 * 1000000;
let pseudoTerminal: PseudoTerminal | null;
const childProcesses = new Set<ChildProcess | PseudoTtyProcess>();

function loadEnvVarsFile(path: string, env: Record<string, string> = {}) {
  unloadDotEnvFile(path, env);
  const result = loadAndExpandDotEnvFile(path, env);
  if (result.error) {
    throw result.error;
  }
}

function loadEnvVars(path?: string, env: Record<string, string> = {}) {
  if (path) {
    loadEnvVarsFile(path, env);
  } else {
    try {
      loadEnvVarsFile('.env', env);
    } catch {}
  }
}

export type Json = {
  [k: string]: any;
};

export interface RunCommandsOptions extends Json {
  command?: string | string[];
  commands?: (
    | {
        command: string;
        forwardAllArgs?: boolean;
        /**
         * description was added to allow users to document their commands inline,
         * it is not intended to be used as part of the execution of the command.
         */
        description?: string;
        prefix?: string;
        color?: string;
        bgColor?: string;
      }
    | string
  )[];
  color?: boolean;
  parallel?: boolean;
  readyWhen?: string | string[];
  cwd?: string;
  env?: Record<string, string>;
  forwardAllArgs?: boolean; // default is true
  args?: string | string[];
  envFile?: string;
  __unparsed__: string[];
  usePty?: boolean;
  streamOutput?: boolean;
  tty?: boolean;
}

const propKeys = [
  'command',
  'commands',
  'color',
  'no-color',
  'parallel',
  'no-parallel',
  'readyWhen',
  'cwd',
  'args',
  'envFile',
  '__unparsed__',
  'env',
  'usePty',
  'streamOutput',
  'verbose',
  'forwardAllArgs',
  'tty',
];

export interface NormalizedRunCommandsOptions extends RunCommandsOptions {
  commands: {
    command: string;
    forwardAllArgs?: boolean;
  }[];
  unknownOptions?: {
    [k: string]: any;
  };
  parsedArgs: {
    [k: string]: any;
  };
  unparsedCommandArgs?: {
    [k: string]: string | string[];
  };
  args?: string;
  readyWhenStatus: { stringToMatch: string; found: boolean }[];
}

export default async function (
  options: RunCommandsOptions,
  context: ExecutorContext
): Promise<{
  success: boolean;
  terminalOutput: string;
}> {
  registerProcessListener();
  const normalized = normalizeOptions(options);

  if (normalized.readyWhenStatus.length && !normalized.parallel) {
    throw new Error(
      'ERROR: Bad executor config for run-commands - "readyWhen" can only be used when "parallel=true".'
    );
  }

  if (
    options.commands.find((c: any) => c.prefix || c.color || c.bgColor) &&
    !options.parallel
  ) {
    throw new Error(
      'ERROR: Bad executor config for run-commands - "prefix", "color" and "bgColor" can only be set when "parallel=true".'
    );
  }

  try {
    const result = options.parallel
      ? await runInParallel(normalized, context)
      : await runSerially(normalized, context);
    return result;
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
    throw new Error(
      `ERROR: Something went wrong in run-commands - ${e.message}`
    );
  }
}

async function runInParallel(
  options: NormalizedRunCommandsOptions,
  context: ExecutorContext
): Promise<{ success: boolean; terminalOutput: string }> {
  const procs = options.commands.map((c) =>
    createProcess(
      null,
      c,
      options.readyWhenStatus,
      options.color,
      calculateCwd(options.cwd, context),
      options.env ?? {},
      true,
      options.usePty,
      options.streamOutput,
      options.tty,
      options.envFile
    ).then((result: { success: boolean; terminalOutput: string }) => ({
      result,
      command: c.command,
    }))
  );

  let terminalOutput = '';
  if (options.readyWhenStatus.length) {
    const r: {
      result: { success: boolean; terminalOutput: string };
      command: string;
    } = await Promise.race(procs);
    terminalOutput += r.result.terminalOutput;
    if (!r.result.success) {
      const output = `Warning: command "${r.command}" exited with non-zero status code`;
      terminalOutput += output;
      if (options.streamOutput) {
        process.stderr.write(output);
      }
      return { success: false, terminalOutput };
    } else {
      return { success: true, terminalOutput };
    }
  } else {
    const r: {
      result: { success: boolean; terminalOutput: string };
      command: string;
    }[] = await Promise.all(procs);
    terminalOutput += r.map((f) => f.result.terminalOutput).join('');
    const failed = r.filter((v) => !v.result.success);
    if (failed.length > 0) {
      const output = failed
        .map(
          (f) =>
            `Warning: command "${f.command}" exited with non-zero status code`
        )
        .join('\r\n');
      terminalOutput += output;
      if (options.streamOutput) {
        process.stderr.write(output);
      }
      return {
        success: false,
        terminalOutput,
      };
    } else {
      return {
        success: true,
        terminalOutput,
      };
    }
  }
}

function normalizeOptions(
  options: RunCommandsOptions
): NormalizedRunCommandsOptions {
  if (options.readyWhen && typeof options.readyWhen === 'string') {
    options.readyWhenStatus = [
      { stringToMatch: options.readyWhen, found: false },
    ];
  } else {
    options.readyWhenStatus =
      (options.readyWhen as string[])?.map((stringToMatch) => ({
        stringToMatch,
        found: false,
      })) ?? [];
  }

  if (options.command) {
    options.commands = [
      {
        command: Array.isArray(options.command)
          ? options.command.join(' ')
          : options.command,
      },
    ];
    options.parallel = options.readyWhenStatus?.length > 0;
  } else {
    options.commands = options.commands.map((c) =>
      typeof c === 'string' ? { command: c } : c
    );
  }

  if (options.args && Array.isArray(options.args)) {
    options.args = options.args.join(' ');
  }

  const unparsedCommandArgs = yargsParser(options.__unparsed__, {
    configuration: {
      'parse-numbers': false,
      'parse-positional-numbers': false,
      'dot-notation': false,
      'camel-case-expansion': false,
    },
  });
  options.unknownOptions = Object.keys(options)
    .filter(
      (p) => propKeys.indexOf(p) === -1 && unparsedCommandArgs[p] === undefined
    )
    .reduce((m, c) => ((m[c] = options[c]), m), {});

  options.parsedArgs = parseArgs(
    unparsedCommandArgs,
    options.unknownOptions,
    options.args as string
  );
  options.unparsedCommandArgs = unparsedCommandArgs;

  (options as NormalizedRunCommandsOptions).commands.forEach((c) => {
    c.command = interpolateArgsIntoCommand(
      c.command,
      options as NormalizedRunCommandsOptions,
      c.forwardAllArgs ?? options.forwardAllArgs ?? true
    );
  });
  return options as NormalizedRunCommandsOptions;
}

async function runSerially(
  options: NormalizedRunCommandsOptions,
  context: ExecutorContext
): Promise<{ success: boolean; terminalOutput: string }> {
  pseudoTerminal ??= PseudoTerminal.isSupported() ? getPseudoTerminal() : null;
  let terminalOutput = '';
  for (const c of options.commands) {
    const result: { success: boolean; terminalOutput: string } =
      await createProcess(
        pseudoTerminal,
        c,
        [],
        options.color,
        calculateCwd(options.cwd, context),
        options.processEnv ?? options.env ?? {},
        false,
        options.usePty,
        options.streamOutput,
        options.tty,
        options.envFile
      );
    terminalOutput += result.terminalOutput;
    if (!result.success) {
      const output = `Warning: command "${c.command}" exited with non-zero status code`;
      result.terminalOutput += output;
      if (options.streamOutput) {
        process.stderr.write(output);
      }
      return { success: false, terminalOutput };
    }
  }
  return { success: true, terminalOutput };
}

async function createProcess(
  pseudoTerminal: PseudoTerminal | null,
  commandConfig: {
    command: string;
    color?: string;
    bgColor?: string;
    prefix?: string;
  },
  readyWhenStatus: { stringToMatch: string; found: boolean }[] = [],
  color: boolean,
  cwd: string,
  env: Record<string, string>,
  isParallel: boolean,
  usePty: boolean = true,
  streamOutput: boolean = true,
  tty: boolean,
  envFile?: string
): Promise<{ success: boolean; terminalOutput: string }> {
  env = processEnv(color, cwd, env, envFile);
  // The rust runCommand is always a tty, so it will not look nice in parallel and if we need prefixes
  // currently does not work properly in windows
  if (
    pseudoTerminal &&
    process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
    !commandConfig.prefix &&
    readyWhenStatus.length === 0 &&
    !isParallel &&
    usePty
  ) {
    let terminalOutput = chalk.dim('> ') + commandConfig.command + '\r\n\r\n';
    if (streamOutput) {
      process.stdout.write(terminalOutput);
    }

    const cp = pseudoTerminal.runCommand(commandConfig.command, {
      cwd,
      jsEnv: env,
      quiet: !streamOutput,
      tty,
    });

    childProcesses.add(cp);

    return new Promise((res) => {
      cp.onOutput((output) => {
        terminalOutput += output;
      });

      cp.onExit((code) => {
        if (code >= 128) {
          process.exit(code);
        } else {
          res({ success: code === 0, terminalOutput });
        }
      });
    });
  }

  return nodeProcess(commandConfig, cwd, env, readyWhenStatus, streamOutput);
}

function nodeProcess(
  commandConfig: {
    command: string;
    color?: string;
    bgColor?: string;
    prefix?: string;
  },
  cwd: string,
  env: Record<string, string>,
  readyWhenStatus: { stringToMatch: string; found: boolean }[],
  streamOutput = true
): Promise<{ success: boolean; terminalOutput: string }> {
  let terminalOutput = chalk.dim('> ') + commandConfig.command + '\r\n\r\n';
  if (streamOutput) {
    process.stdout.write(terminalOutput);
  }
  return new Promise((res) => {
    const childProcess = exec(commandConfig.command, {
      maxBuffer: LARGE_BUFFER,
      env,
      cwd,
    });

    childProcesses.add(childProcess);

    childProcess.stdout.on('data', (data) => {
      const output = addColorAndPrefix(data, commandConfig);
      terminalOutput += output;
      if (streamOutput) {
        process.stdout.write(output);
      }
      if (readyWhenStatus.length && isReady(readyWhenStatus, data.toString())) {
        res({ success: true, terminalOutput });
      }
    });
    childProcess.stderr.on('data', (err) => {
      const output = addColorAndPrefix(err, commandConfig);
      terminalOutput += output;
      if (streamOutput) {
        process.stderr.write(output);
      }
      if (readyWhenStatus.length && isReady(readyWhenStatus, err.toString())) {
        res({ success: true, terminalOutput });
      }
    });
    childProcess.on('error', (err) => {
      const ouptput = addColorAndPrefix(err.toString(), commandConfig);
      terminalOutput += ouptput;
      if (streamOutput) {
        process.stderr.write(ouptput);
      }
      res({ success: false, terminalOutput });
    });
    childProcess.on('exit', (code) => {
      childProcesses.delete(childProcess);
      if (!readyWhenStatus.length || isReady(readyWhenStatus)) {
        res({ success: code === 0, terminalOutput });
      }
    });
  });
}

function addColorAndPrefix(
  out: string,
  config: {
    prefix?: string;
    color?: string;
    bgColor?: string;
  }
) {
  if (config.prefix) {
    out = out
      .split('\n')
      .map((l) =>
        l.trim().length > 0 ? `${chalk.bold(config.prefix)} ${l}` : l
      )
      .join('\n');
  }
  if (config.color && chalk[config.color]) {
    out = chalk[config.color](out);
  }
  if (config.bgColor && chalk[config.bgColor]) {
    out = chalk[config.bgColor](out);
  }
  return out;
}

function calculateCwd(
  cwd: string | undefined,
  context: ExecutorContext
): string {
  if (!cwd) return context.root;
  if (path.isAbsolute(cwd)) return cwd;
  return path.join(context.root, cwd);
}

function processEnv(
  color: boolean,
  cwd: string,
  env: Record<string, string>,
  envFile?: string
) {
  const localEnv = appendLocalEnv({ cwd: cwd ?? process.cwd() });
  const res = {
    ...process.env,
    ...localEnv,
    ...env,
  };
  if (process.env.NX_LOAD_DOT_ENV_FILES !== 'false') {
    loadEnvVars(envFile, res);
  }
  // need to override PATH to make sure we are using the local node_modules
  if (localEnv.PATH) res.PATH = localEnv.PATH; // UNIX-like
  if (localEnv.Path) res.Path = localEnv.Path; // Windows

  if (color) {
    res.FORCE_COLOR = `${color}`;
  }
  return res;
}

export function interpolateArgsIntoCommand(
  command: string,
  opts: Pick<
    NormalizedRunCommandsOptions,
    | 'args'
    | 'parsedArgs'
    | '__unparsed__'
    | 'unknownOptions'
    | 'unparsedCommandArgs'
  >,
  forwardAllArgs: boolean
): string {
  if (command.indexOf('{args.') > -1) {
    const regex = /{args\.([^}]+)}/g;
    return command.replace(regex, (_, group: string) =>
      opts.parsedArgs[group] !== undefined ? opts.parsedArgs[group] : ''
    );
  } else if (forwardAllArgs) {
    let args = '';
    if (Object.keys(opts.unknownOptions ?? {}).length > 0) {
      const unknownOptionsArgs = Object.keys(opts.unknownOptions)
        .filter(
          (k) =>
            typeof opts.unknownOptions[k] !== 'object' &&
            opts.parsedArgs[k] === opts.unknownOptions[k]
        )
        .map((k) => `--${k}=${opts.unknownOptions[k]}`)
        .map(wrapArgIntoQuotesIfNeeded)
        .join(' ');
      if (unknownOptionsArgs) {
        args += ` ${unknownOptionsArgs}`;
      }
    }
    if (opts.args) {
      args += ` ${opts.args}`;
    }
    if (opts.__unparsed__?.length > 0) {
      const filteredParsedOptions = filterPropKeysFromUnParsedOptions(
        opts.__unparsed__,
        opts.parsedArgs
      );
      if (filteredParsedOptions.length > 0) {
        args += ` ${filteredParsedOptions
          .map(wrapArgIntoQuotesIfNeeded)
          .join(' ')}`;
      }
    }
    return `${command}${args}`;
  } else {
    return command;
  }
}

function parseArgs(
  unparsedCommandArgs: { [k: string]: string },
  unknownOptions: { [k: string]: string },
  args?: string
) {
  if (!args) {
    return { ...unknownOptions, ...unparsedCommandArgs };
  }

  return {
    ...unknownOptions,
    ...yargsParser(args.replace(/(^"|"$)/g, ''), {
      configuration: { 'camel-case-expansion': true },
    }),
    ...unparsedCommandArgs,
  };
}

/**
 * This function filters out the prop keys from the unparsed options
 * @param __unparsed__ e.g. ['--prop1', 'value1', '--prop2=value2', '--args=test']
 * @param unparsedCommandArgs e.g. { prop1: 'value1', prop2: 'value2', args: 'test'}
 * @returns filtered options that are not part of the propKeys array e.g. ['--prop1', 'value1', '--prop2=value2']
 */
function filterPropKeysFromUnParsedOptions(
  __unparsed__: string[],
  parseArgs: {
    [k: string]: string | string[];
  } = {}
): string[] {
  const parsedOptions = [];
  for (let index = 0; index < __unparsed__.length; index++) {
    const element = __unparsed__[index];
    if (element.startsWith('--')) {
      const key = element.replace('--', '');
      if (element.includes('=')) {
        // key can be in the format of --key=value or --key.subkey=value (e.g. env.foo=bar)
        if (!propKeys.includes(key.split('=')[0].split('.')[0])) {
          // check if the key is part of the propKeys array
          parsedOptions.push(element);
        }
      } else {
        // check if the next element is a value for the key
        if (propKeys.includes(key)) {
          if (
            index + 1 < __unparsed__.length &&
            parseArgs[key] &&
            __unparsed__[index + 1].toString() === parseArgs[key].toString()
          ) {
            index++; // skip the next element
          }
        } else {
          parsedOptions.push(element);
        }
      }
    } else {
      parsedOptions.push(element);
    }
  }
  return parsedOptions;
}

let registered = false;

function registerProcessListener() {
  if (registered) {
    return;
  }

  registered = true;
  // When the nx process gets a message, it will be sent into the task's process
  process.on('message', (message: Serializable) => {
    // this.publisher.publish(message.toString());
    if (pseudoTerminal) {
      pseudoTerminal.sendMessageToChildren(message);
    }

    childProcesses.forEach((p) => {
      if ('connected' in p && p.connected) {
        p.send(message);
      }
    });
  });

  // Terminate any task processes on exit
  process.on('exit', () => {
    childProcesses.forEach((p) => {
      if ('connected' in p ? p.connected : p.isAlive) {
        p.kill();
      }
    });
  });
  process.on('SIGINT', () => {
    childProcesses.forEach((p) => {
      if ('connected' in p ? p.connected : p.isAlive) {
        p.kill('SIGTERM');
      }
    });
    // we exit here because we don't need to write anything to cache.
    process.exit(signalToCode('SIGINT'));
  });
  process.on('SIGTERM', () => {
    childProcesses.forEach((p) => {
      if ('connected' in p ? p.connected : p.isAlive) {
        p.kill('SIGTERM');
      }
    });
    // no exit here because we expect child processes to terminate which
    // will store results to the cache and will terminate this process
  });
  process.on('SIGHUP', () => {
    childProcesses.forEach((p) => {
      if ('connected' in p ? p.connected : p.isAlive) {
        p.kill('SIGTERM');
      }
    });
    // no exit here because we expect child processes to terminate which
    // will store results to the cache and will terminate this process
  });
}

function wrapArgIntoQuotesIfNeeded(arg: string): string {
  if (arg.includes('=')) {
    const [key, value] = arg.split('=');
    if (
      key.startsWith('--') &&
      value.includes(' ') &&
      !(value[0] === "'" || value[0] === '"')
    ) {
      return `${key}="${value}"`;
    }
    return arg;
  } else if (arg.includes(' ') && !(arg[0] === "'" || arg[0] === '"')) {
    return `"${arg}"`;
  } else {
    return arg;
  }
}

function isReady(
  readyWhenStatus: { stringToMatch: string; found: boolean }[] = [],
  data?: string
): boolean {
  if (data) {
    for (const readyWhenElement of readyWhenStatus) {
      if (data.toString().indexOf(readyWhenElement.stringToMatch) > -1) {
        readyWhenElement.found = true;
        break;
      }
    }
  }

  return readyWhenStatus.every((readyWhenElement) => readyWhenElement.found);
}
