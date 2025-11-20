import * as yargsParser from 'yargs-parser';
import { ExecutorContext } from '../../config/misc-interfaces';
import { isTuiEnabled } from '../../tasks-runner/is-tui-enabled';
import { PseudoTerminal } from '../../tasks-runner/pseudo-terminal';
import { createTaskId } from '../../tasks-runner/utils';
import { NoopChildProcess } from '../../tasks-runner/running-tasks/noop-child-process';
import {
  ParallelRunningTasks,
  runSingleCommandWithPseudoTerminal,
  SeriallyRunningTasks,
} from './running-tasks';

export const LARGE_BUFFER = 1024 * 1000000;
export type Json = {
  [k: string]: any;
};

export interface RunCommandsCommandOptions {
  command: string;
  forwardAllArgs?: boolean;
  /**
   * description was added to allow users to document their commands inline,
   * it is not intended to be used as part of the execution of the command.
   */
  description?: string;
  prefix?: string;
  prefixColor?: string;
  color?: string;
  bgColor?: string;
}

export interface RunCommandsOptions extends Json {
  command?: string | string[];
  commands?: Array<RunCommandsCommandOptions | string>;
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
  commands: Array<RunCommandsCommandOptions>;
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
  const task = await runCommands(options, context);
  const results = await task.getResults();
  return {
    ...results,
    success: results.code === 0,
  };
}

export async function runCommands(
  options: RunCommandsOptions,
  context: ExecutorContext,
  taskId?: string
) {
  const normalized = normalizeOptions(options);

  if (normalized.readyWhenStatus.length && !normalized.parallel) {
    throw new Error(
      'ERROR: Bad executor config for run-commands - "readyWhen" can only be used when "parallel=true".'
    );
  }

  if (
    options.commands.find(
      (c: any) => c.prefix || c.prefixColor || c.color || c.bgColor
    ) &&
    !options.parallel
  ) {
    throw new Error(
      'ERROR: Bad executor config for run-commands - "prefix", "prefixColor", "color" and "bgColor" can only be set when "parallel=true".'
    );
  }

  // Handle empty commands array - return immediately with success
  if (normalized.commands.length === 0) {
    return new NoopChildProcess({ code: 0, terminalOutput: '' });
  }

  const isSingleCommand = normalized.commands.length === 1;

  const usePseudoTerminal =
    (isSingleCommand || !options.parallel) && PseudoTerminal.isSupported();

  const isSingleCommandAndCanUsePseudoTerminal =
    isSingleCommand &&
    usePseudoTerminal &&
    process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
    !normalized.commands[0].prefix &&
    normalized.usePty;

  const tuiEnabled = isTuiEnabled();

  try {
    const resolvedTaskId =
      taskId ??
      createTaskId(
        context.projectName,
        context.targetName,
        context.configurationName
      );
    const runningTask = isSingleCommandAndCanUsePseudoTerminal
      ? await runSingleCommandWithPseudoTerminal(
          normalized,
          context,
          resolvedTaskId
        )
      : options.parallel
      ? new ParallelRunningTasks(normalized, context, resolvedTaskId)
      : new SeriallyRunningTasks(
          normalized,
          context,
          tuiEnabled,
          resolvedTaskId
        );
    return runningTask;
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
    throw new Error(
      `ERROR: Something went wrong in run-commands - ${e.message}`
    );
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
  if (command.indexOf('{args.') > -1 && command.indexOf('{args}') > -1) {
    throw new Error(
      'Command should not contain both {args} and {args.*} values. Please choose one to use.'
    );
  }
  if (command.indexOf('{args.') > -1) {
    const regex = /{args\.([^}]+)}/g;
    return command.replace(regex, (_, group: string) =>
      opts.parsedArgs[group] !== undefined ? opts.parsedArgs[group] : ''
    );
  } else if (command.indexOf('{args}') > -1) {
    const regex = /{args}/g;
    const args = [
      ...unknownOptionsToArgsArray(opts),
      ...unparsedOptionsToArgsArray(opts),
    ];
    const argsString = `${args.join(' ')} ${opts.args ?? ''}`;
    return command.replace(regex, argsString);
  } else if (forwardAllArgs) {
    let args = '';
    if (Object.keys(opts.unknownOptions ?? {}).length > 0) {
      const unknownOptionsArgs = unknownOptionsToArgsArray(opts).join(' ');
      if (unknownOptionsArgs) {
        args += ` ${unknownOptionsArgs}`;
      }
    }
    if (opts.args) {
      args += ` ${opts.args}`;
    }
    if (opts.__unparsed__?.length > 0) {
      const filteredParsedOptions = unparsedOptionsToArgsArray(opts);
      if (filteredParsedOptions.length > 0) {
        args += ` ${filteredParsedOptions.join(' ')}`;
      }
    }
    return `${command}${args}`;
  } else {
    return command;
  }
}

function unknownOptionsToArgsArray(
  opts: Pick<
    NormalizedRunCommandsOptions,
    | 'args'
    | 'parsedArgs'
    | '__unparsed__'
    | 'unknownOptions'
    | 'unparsedCommandArgs'
  >
) {
  return Object.keys(opts.unknownOptions ?? {})
    .filter(
      (k) =>
        typeof opts.unknownOptions[k] !== 'object' &&
        opts.parsedArgs[k] === opts.unknownOptions[k]
    )
    .map((k) => `--${k}=${opts.unknownOptions[k]}`)
    .map(wrapArgIntoQuotesIfNeeded);
}

function unparsedOptionsToArgsArray(
  opts: Pick<
    NormalizedRunCommandsOptions,
    | 'args'
    | 'parsedArgs'
    | '__unparsed__'
    | 'unknownOptions'
    | 'unparsedCommandArgs'
  >
) {
  const filteredParsedOptions = filterPropKeysFromUnParsedOptions(
    opts.__unparsed__,
    opts.parsedArgs
  );
  if (filteredParsedOptions.length > 0) {
    return filteredParsedOptions.map(wrapArgIntoQuotesIfNeeded);
  }
  return [];
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
