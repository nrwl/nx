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
  }[];
  parsedArgs: { [k: string]: any };
}

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
  const procs = options.commands.map((c) =>
    createProcess(
      c.command,
      options.readyWhen,
      options.color,
      calculateCwd(options.cwd, context)
    ).then((result) => ({
      result,
      command: c.command,
    }))
  );

  if (options.readyWhen) {
    const r = await Promise.race(procs);
    if (!r.result) {
      process.stderr.write(
        `Warning: @nrwl/run-commands command "${r.command}" exited with non-zero status code`
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
          `Warning: @nrwl/run-commands command "${f.command}" exited with non-zero status code`
        );
      });
      return false;
    } else {
      return true;
    }
  }
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
      options as NormalizedRunCommandsBuilderOptions,
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

function createProcess(
  command: string,
  readyWhen: string,
  color: boolean,
  cwd: string
): Promise<boolean> {
  return new Promise((res) => {
    const childProcess = exec(command, {
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
    });
    childProcess.stderr.on('data', (err) => {
      process.stderr.write(err);
      if (readyWhen && err.toString().indexOf(readyWhen) > -1) {
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
    stdio: ['inherit', 'inherit', 'inherit'],
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
  options: NormalizedRunCommandsBuilderOptions,
  forwardAllArgs: boolean
) {
  const { parsedArgs } = options;
  const args: { [key: string]: string } = parsedArgs;
  if (/{([\s\S]+?)}/g.test(command)) {
    return interpolateCommand(command, { ...options, args });
  } else if (Object.keys(args).length > 0 && forwardAllArgs) {
    const stringifiedArgs = Object.keys(args)
      .map((a) =>
        typeof args[a] === 'string' && args[a].includes(' ')
          ? `--${a}="${args[a].replace(/"/g, '"')}"`
          : `--${a}=${args[a]}`
      )
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

function interpolateCommand(template: string, data: any) {
  return template.replace(/{([\s\S]+?)}/g, (match) => {
    let value = data;
    let path = match.slice(1, -1).trim().split('.');
    for (let idx = 0; idx < path.length; idx++) {
      value = value[camelCase(path[idx])];
    }

    return value;
  });
}
