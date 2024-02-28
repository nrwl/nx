import { exec } from 'child_process';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { env as appendLocalEnv } from 'npm-run-path';
import { ExecutorContext } from '../../config/misc-interfaces';
import * as chalk from 'chalk';
import { runCommand } from '../../native';
import { PseudoTtyProcess } from '../../utils/child-process';

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
];

export interface NormalizedRunCommandsOptions extends RunCommandsOptions {
  commands: {
    command: string;
    forwardAllArgs?: boolean;
  }[];
  parsedArgs: {
    [k: string]: any;
  };
  args?: string;
}

export default async function (
  options: RunCommandsOptions,
  context: ExecutorContext
): Promise<{
  success: boolean;
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
    const success = options.parallel
      ? await runInParallel(normalized, context)
      : await runSerially(normalized, context);
    return { success };
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
) {
  const procs = options.commands.map((c) =>
    createProcess(
      c,
      options.readyWhen,
      options.color,
      calculateCwd(options.cwd, context),
      options.env ?? {},
      true
    ).then((result) => ({
      result,
      command: c.command,
    }))
  );

  if (options.readyWhen) {
    const r = await Promise.race(procs);
    if (!r.result) {
      process.stderr.write(
        `Warning: command "${r.command}" exited with non-zero status code`
      );
      return false;
    } else {
      return true;
    }
  } else {
    const r = await Promise.all(procs);
    const failed = r.filter((v) => !v.result);
    if (failed.length > 0) {
      failed.forEach((f) => {
        process.stderr.write(
          `Warning: command "${f.command}" exited with non-zero status code`
        );
      });
      return false;
    } else {
      return true;
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
  options.parsedArgs = parseArgs(options, options.args as string);

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
) {
  for (const c of options.commands) {
    const success = await createProcess(
      c,
      undefined,
      options.color,
      calculateCwd(options.cwd, context),
      options.env ?? {},
      false
    );
    if (!success) {
      process.stderr.write(
        `Warning: command "${c.command}" exited with non-zero status code`
      );
      return false;
    }
  }

  return true;
}

async function createProcess(
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
  isParallel: boolean
): Promise<boolean> {
  env = processEnv(color, cwd, env);
  // The rust runCommand is always a tty, so it will not look nice in parallel and if we need prefixes
  // currently does not work properly in windows
  if (
    process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
    process.stdout.isTTY &&
    !commandConfig.prefix &&
    !isParallel
  ) {
    const cp = new PseudoTtyProcess(
      runCommand(commandConfig.command, cwd, env)
    );

    return new Promise((res) => {
      cp.onOutput((output) => {
        if (readyWhen && output.indexOf(readyWhen) > -1) {
          res(true);
        }
      });

      cp.onExit((code) => {
        if (code === 0) {
          res(true);
        } else if (code >= 128) {
          process.exit(code);
        } else {
          res(false);
        }
      });
    });
  }

  return nodeProcess(commandConfig, color, cwd, env, readyWhen);
}

function nodeProcess(
  commandConfig: {
    command: string;
    color?: string;
    bgColor?: string;
    prefix?: string;
  },
  color: boolean,
  cwd: string,
  env: Record<string, string>,
  readyWhen: string
): Promise<boolean> {
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
      process.stdout.write(addColorAndPrefix(data, commandConfig));
      if (readyWhen && data.toString().indexOf(readyWhen) > -1) {
        res(true);
      }
    });
    childProcess.stderr.on('data', (err) => {
      process.stderr.write(addColorAndPrefix(err, commandConfig));
      if (readyWhen && err.toString().indexOf(readyWhen) > -1) {
        res(true);
      }
    });
    childProcess.on('error', (err) => {
      process.stderr.write(addColorAndPrefix(err.toString(), commandConfig));
      res(false);
    });
    childProcess.on('exit', (code) => {
      if (!readyWhen) {
        res(code === 0);
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
  const res = {
    ...process.env,
    ...appendLocalEnv({ cwd: cwd ?? process.cwd() }),
    ...env,
  };

  if (color) {
    res.FORCE_COLOR = `${color}`;
  }
  return res;
}

export function interpolateArgsIntoCommand(
  command: string,
  opts: Pick<
    NormalizedRunCommandsOptions,
    'args' | 'parsedArgs' | '__unparsed__'
  >,
  forwardAllArgs: boolean
) {
  if (command.indexOf('{args.') > -1) {
    const regex = /{args\.([^}]+)}/g;
    return command.replace(regex, (_, group: string) =>
      opts.parsedArgs[group] !== undefined ? opts.parsedArgs[group] : ''
    );
  } else if (forwardAllArgs) {
    return `${command}${opts.args ? ' ' + opts.args : ''}${
      opts.__unparsed__.length > 0 ? ' ' + opts.__unparsed__.join(' ') : ''
    }`;
  } else {
    return command;
  }
}

function parseArgs(options: RunCommandsOptions, args?: string) {
  if (!args) {
    const unknownOptionsTreatedAsArgs = Object.keys(options)
      .filter((p) => propKeys.indexOf(p) === -1)
      .reduce((m, c) => ((m[c] = options[c]), m), {});

    const unparsedCommandArgs = yargsParser(options.__unparsed__, {
      configuration: {
        'parse-numbers': false,
        'parse-positional-numbers': false,
        'dot-notation': false,
      },
    });
    return { ...unknownOptionsTreatedAsArgs, ...unparsedCommandArgs };
  }
  return yargsParser(args.replace(/(^"|"$)/g, ''), {
    configuration: { 'camel-case-expansion': false },
  });
}
