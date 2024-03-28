import { exec } from 'child_process';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { env as appendLocalEnv } from 'npm-run-path';
import { ExecutorContext } from '../../config/misc-interfaces';
import * as chalk from 'chalk';
import {
  getPseudoTerminal,
  PseudoTerminal,
} from '../../tasks-runner/pseudo-terminal';
import { output } from '../../utils/output';

export const LARGE_BUFFER = 1024 * 1000000;

async function loadEnvVars(path?: string) {
  if (path) {
    const result = (await import('dotenv')).config({ path });
    if (result.error) {
      throw result.error;
    }
  } else {
    try {
      (await import('dotenv')).config();
    } catch {}
  }
}

export type Json = {
  [k: string]: any;
};

export interface RunCommandsOptions extends Json {
  command?: string;
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
  readyWhen?: string;
  cwd?: string;
  env?: Record<string, string>;
  args?: string | string[];
  envFile?: string;
  __unparsed__: string[];
  usePty?: boolean;
  streamOutput?: boolean;
}

const propKeys = [
  'command',
  'commands',
  'color',
  'parallel',
  'readyWhen',
  'cwd',
  'args',
  'envFile',
  '__unparsed__',
  'env',
  'usePty',
  'streamOutput',
  'verbose',
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
    [k: string]: string;
  };
  args?: string;
}

export default async function (
  options: RunCommandsOptions,
  context: ExecutorContext
): Promise<{
  success: boolean;
  terminalOutput: string;
}> {
  await loadEnvVars(options.envFile);
  const normalized = normalizeOptions(options);

  if (options.readyWhen && !options.parallel) {
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
      options.readyWhen,
      options.color,
      calculateCwd(options.cwd, context),
      options.env ?? {},
      true,
      options.usePty,
      options.streamOutput
    ).then((result: { success: boolean; terminalOutput: string }) => ({
      result,
      command: c.command,
    }))
  );

  let terminalOutput = '';
  if (options.readyWhen) {
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
  if (options.command) {
    options.commands = [{ command: options.command }];
    options.parallel = !!options.readyWhen;
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
      c.forwardAllArgs ?? true
    );
  });
  return options as NormalizedRunCommandsOptions;
}

async function runSerially(
  options: NormalizedRunCommandsOptions,
  context: ExecutorContext
): Promise<{ success: boolean; terminalOutput: string }> {
  const pseudoTerminal = PseudoTerminal.isSupported()
    ? getPseudoTerminal()
    : null;
  let terminalOutput = '';
  for (const c of options.commands) {
    const result: { success: boolean; terminalOutput: string } =
      await createProcess(
        pseudoTerminal,
        c,
        undefined,
        options.color,
        calculateCwd(options.cwd, context),
        options.env ?? {},
        false,
        options.usePty,
        options.streamOutput
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
  readyWhen: string,
  color: boolean,
  cwd: string,
  env: Record<string, string>,
  isParallel: boolean,
  usePty: boolean = true,
  streamOutput: boolean = true
): Promise<{ success: boolean; terminalOutput: string }> {
  env = processEnv(color, cwd, env);
  // The rust runCommand is always a tty, so it will not look nice in parallel and if we need prefixes
  // currently does not work properly in windows
  if (
    pseudoTerminal &&
    process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
    !commandConfig.prefix &&
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
    });

    return new Promise((res) => {
      cp.onOutput((output) => {
        terminalOutput += output;
        if (readyWhen && output.indexOf(readyWhen) > -1) {
          res({ success: true, terminalOutput });
        }
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

  return nodeProcess(commandConfig, cwd, env, readyWhen, streamOutput);
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
  readyWhen: string,
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
    /**
     * Ensure the child process is killed when the parent exits
     */
    const processExitListener = (signal?: number | NodeJS.Signals) =>
      childProcess.kill(signal);

    process.on('exit', processExitListener);
    process.on('SIGTERM', processExitListener);
    process.on('SIGINT', processExitListener);
    process.on('SIGQUIT', processExitListener);

    childProcess.stdout.on('data', (data) => {
      const output = addColorAndPrefix(data, commandConfig);
      terminalOutput += output;
      if (streamOutput) {
        process.stdout.write(output);
      }
      if (readyWhen && data.toString().indexOf(readyWhen) > -1) {
        res({ success: true, terminalOutput });
      }
    });
    childProcess.stderr.on('data', (err) => {
      const output = addColorAndPrefix(err, commandConfig);
      terminalOutput += output;
      if (streamOutput) {
        process.stderr.write(output);
      }
      if (readyWhen && err.toString().indexOf(readyWhen) > -1) {
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
      if (!readyWhen) {
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

function processEnv(color: boolean, cwd: string, env: Record<string, string>) {
  const localEnv = appendLocalEnv({ cwd: cwd ?? process.cwd() });
  const res = {
    ...process.env,
    ...localEnv,
    ...env,
  };
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
      args +=
        ' ' +
        Object.keys(opts.unknownOptions)
          .filter(
            (k) =>
              typeof opts.unknownOptions[k] !== 'object' &&
              opts.parsedArgs[k] === opts.unknownOptions[k]
          )
          .map((k) => `--${k} ${opts.unknownOptions[k]}`)
          .join(' ');
    }
    if (opts.args) {
      args += ` ${opts.args}`;
    }
    if (opts.__unparsed__?.length > 0) {
      const filterdParsedOptions = filterPropKeysFromUnParsedOptions(
        opts.__unparsed__,
        opts.unparsedCommandArgs
      );
      if (filterdParsedOptions.length > 0) {
        args += ` ${filterdParsedOptions.join(' ')}`;
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
  return yargsParser(args.replace(/(^"|"$)/g, ''), {
    configuration: { 'camel-case-expansion': false },
  });
}

/**
 * This function filters out the prop keys from the unparsed options
 * @param __unparsed__ e.g. ['--prop1', 'value1', '--prop2=value2', '--args=test']
 * @param unparsedCommandArgs e.g. { prop1: 'value1', prop2: 'value2', args: 'test'}
 * @returns filtered options that are not part of the propKeys array e.g. ['--prop1', 'value1', '--prop2=value2']
 */
function filterPropKeysFromUnParsedOptions(
  __unparsed__: string[],
  unparsedCommandArgs: {
    [k: string]: string;
  } = {}
): string[] {
  const parsedOptions = [];
  for (let index = 0; index < __unparsed__.length; index++) {
    const element = __unparsed__[index];
    if (element.startsWith('--')) {
      const key = element.replace('--', '');
      if (element.includes('=')) {
        if (!propKeys.includes(key.split('=')[0].split('.')[0])) {
          // check if the key is part of the propKeys array
          parsedOptions.push(element);
        }
      } else {
        // check if the next element is a value for the key
        if (propKeys.includes(key)) {
          if (
            index + 1 < __unparsed__.length &&
            __unparsed__[index + 1] === unparsedCommandArgs[key]
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
