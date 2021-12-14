import { ExecutorContext } from '@nrwl/devkit';
import { exec, execSync } from 'child_process';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { env as appendLocalEnv } from 'npm-run-path';

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

export type Json = { [k: string]: any };
export interface RunCommandsBuilderOptions extends Json {
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
        name?: string;
        readyWhen?: string;
        waitUntilCommand?: string;
      }
    | string
  )[];
  color?: boolean;
  parallel?: boolean;
  readyWhen?: string;
  cwd?: string;
  args?: string;
  envFile?: string;
  outputPath?: string;
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
  'outputPath',
];

export interface NormalizedRunCommandsBuilderOptions
  extends RunCommandsBuilderOptions {
  commands: {
    command: string;
    forwardAllArgs?: boolean;
    name?: string;
    readyWhen?: string;
    waitUntilCommand?: string;
  }[];
  parsedArgs: { [k: string]: any };
}
export type Command = NormalizedRunCommandsBuilderOptions['commands'][0];

export default async function (
  options: RunCommandsBuilderOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  await loadEnvVars(options.envFile);
  const normalized = normalizeOptions(options);

  if (options.readyWhen && !options.parallel) {
    throw new Error(
      'ERROR: Bad executor config for @nrwl/run-commands - "readyWhen" can only be used when "parallel=true".'
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
      `ERROR: Something went wrong in @nrwl/run-commands - ${e.message}`
    );
  }
}

async function runInParallel(
  options: NormalizedRunCommandsBuilderOptions,
  context: ExecutorContext
) {
  const { completedCommands, commandsByWaitingFor } = options.commands?.reduce(
    (
      acc: {
        completedCommands: Record<string, boolean>;
        commandsByWaitingFor: Record<string, Command[]>;
      },
      command
    ) => {
      if (command.name) {
        acc.completedCommands[command.name] = false;
      }
      // default group are commands that aren't dependent on any prior commands
      const waitUntilCommandKey = command.waitUntilCommand ?? 'default';
      acc.commandsByWaitingFor[waitUntilCommandKey] =
        acc.commandsByWaitingFor[waitUntilCommandKey] ?? [];
      acc.commandsByWaitingFor[waitUntilCommandKey].push(command);
      return acc;
    },
    { completedCommands: {}, commandsByWaitingFor: {} }
  );

  const setupProcsBuilder =
    (readyWhen: string, color: boolean, cwd: string) => (commands: Command[]) =>
      commands.map((command) =>
        createProcess({
          command,
          readyWhen,
          color,
          cwd,
        }).then((result) => {
          if (command.name) {
            completedCommands[command.name] = true;
          }
          return {
            result,
            command,
          };
        })
      );

  const procsBuilder = setupProcsBuilder(
    options.readyWhen,
    options.color,
    calculateCwd(options.cwd, context)
  );

  const processProcs = async (procs: ReturnType<typeof procsBuilder>) => {
    if (options.readyWhen) {
      const commandResults = await Promise.race(procs);
      if (!commandResults.result) {
        process.stderr.write(
          `Warning: @nrwl/run-commands command "${commandResults.command.command}" exited with non-zero status code`
        );
        return false;
      }
      return true;
    } else {
      const commandResults = await Promise.all(procs);
      const failed = commandResults.filter(
        (commandResult) => !commandResult.result
      );
      if (failed.length > 0) {
        failed.forEach((failure) => {
          process.stderr.write(
            `Warning: @nrwl/run-commands command "${failure.command.command}" exited with non-zero status code`
          );
        });
        return false;
      }
      return true;
    }
  };

  const results: Array<boolean> = [];

  do {
    if (!completedCommands.default) {
      results.push(
        await processProcs(procsBuilder(commandsByWaitingFor.default))
      );
      commandsByWaitingFor.default.length = 0;
    }
    for (const [commandName, commandCompleted] of Object.entries(
      completedCommands
    )) {
      if (commandCompleted && commandsByWaitingFor[commandName]?.length > 0) {
        const procs = procsBuilder(commandsByWaitingFor[commandName]);
        commandsByWaitingFor[commandName].length = 0;
        results.push(await processProcs(procs));
      }
    }
  } while (
    results.every(Boolean) &&
    Object.values(commandsByWaitingFor).some((commands) => commands.length > 0)
  );

  return results.every(Boolean);
}

function normalizeOptions(
  options: RunCommandsBuilderOptions
): NormalizedRunCommandsBuilderOptions {
  options.parsedArgs = parseArgs(options);

  if (options.command) {
    options.commands = [{ command: options.command }];
    options.parallel = !!options.readyWhen;
  } else {
    options.commands = options.commands.map((c) =>
      typeof c === 'string' ? { command: c } : c
    );
  }
  (options as NormalizedRunCommandsBuilderOptions).commands.forEach((c) => {
    c.command = transformCommand(
      c.command,
      (options as NormalizedRunCommandsBuilderOptions).parsedArgs,
      c.forwardAllArgs ?? true
    );
  });
  return options as any;
}

async function runSerially(
  options: NormalizedRunCommandsBuilderOptions,
  context: ExecutorContext
) {
  for (const c of options.commands) {
    createSyncProcess(
      c.command,
      options.color,
      calculateCwd(options.cwd, context)
    );
  }
  return true;
}

function createProcess(options: {
  command: Command;
  readyWhen: string;
  color: boolean;
  cwd: string;
}): Promise<boolean> {
  const { command, readyWhen, color, cwd } = options;
  return new Promise((res) => {
    const childProcess = exec(command.command, {
      maxBuffer: LARGE_BUFFER,
      env: processEnv(color),
      cwd,
    });
    /**
     * Ensure the child process is killed when the parent exits
     */
    const processExitListener = () => childProcess.kill();
    process.on('exit', processExitListener);
    process.on('SIGTERM', processExitListener);
    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
      if (readyWhen && data.toString().indexOf(readyWhen) > -1) {
        res(true);
      }
      if (
        command.readyWhen &&
        data.toString().indexOf(command.readyWhen) > -1
      ) {
        res(true);
      }
    });
    childProcess.stderr.on('data', (err) => {
      process.stderr.write(err);
      if (readyWhen && err.toString().indexOf(readyWhen) > -1) {
        res(true);
      }
      if (command.readyWhen && err.toString().indexOf(command.readyWhen) > -1) {
        res(true);
      }
    });
    childProcess.on('exit', (code) => {
      if (!readyWhen) {
        res(code === 0);
      }
    });
  });
}

function createSyncProcess(command: string, color: boolean, cwd: string) {
  execSync(command, {
    env: processEnv(color),
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
    cwd,
  });
}

function calculateCwd(
  cwd: string | undefined,
  context: ExecutorContext
): string {
  if (!cwd) return context.root;
  if (path.isAbsolute(cwd)) return cwd;
  return path.join(context.root, cwd);
}

function processEnv(color: boolean) {
  const env = {
    ...process.env,
    ...appendLocalEnv(),
  };

  if (color) {
    env.FORCE_COLOR = `${color}`;
  }
  return env;
}

function transformCommand(
  command: string,
  args: { [key: string]: string },
  forwardAllArgs: boolean
) {
  if (command.indexOf('{args.') > -1) {
    const regex = /{args\.([^}]+)}/g;
    return command.replace(regex, (_, group: string) => args[camelCase(group)]);
  } else if (Object.keys(args).length > 0 && forwardAllArgs) {
    const stringifiedArgs = Object.keys(args)
      .map((a) => `--${a}=${args[a]}`)
      .join(' ');
    return `${command} ${stringifiedArgs}`;
  } else {
    return command;
  }
}

function parseArgs(options: RunCommandsBuilderOptions) {
  const args = options.args;
  if (!args) {
    const unknownOptionsTreatedAsArgs = Object.keys(options)
      .filter((p) => propKeys.indexOf(p) === -1)
      .reduce((m, c) => ((m[c] = options[c]), m), {});
    return unknownOptionsTreatedAsArgs;
  }
  return yargsParser(args.replace(/(^"|"$)/g, ''), {
    configuration: { 'camel-case-expansion': true },
  });
}

function camelCase(input) {
  if (input.indexOf('-') > 1) {
    return input
      .toLowerCase()
      .replace(/-(.)/g, (match, group1) => group1.toUpperCase());
  } else {
    return input;
  }
}
