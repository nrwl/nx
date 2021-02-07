import { exec, execSync } from 'child_process';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { pathExistsSync } from 'fs-extra';
import { ExecutorContext } from '@nrwl/devkit';

export const LARGE_BUFFER = 1024 * 1000000;

function loadEnvVars(path?: string) {
  if (path) {
    const result = require('dotenv').config({ path });
    if (result.error) {
      throw result.error;
    }
  } else {
    try {
      require('dotenv').config();
    } catch (e) {}
  }
}

export type Json = { [k: string]: any };
export interface RunCommandsBuilderOptions extends Json {
  command?: string;
  commands?: (
    | {
        command: string;
        forwardAllArgs?: boolean;
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
  loadEnvVars(options.envFile);
  const normalized = normalizeOptions(options);

  if (options.readyWhen && !options.parallel) {
    throw new Error(
      'ERROR: Bad builder config for @nrwl/run-commands - "readyWhen" can only be used when parallel=true'
    );
  }

  try {
    const success = options.parallel
      ? await runInParallel(normalized, context)
      : await runSerially(normalized, context);
    return { success };
  } catch (e) {
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
      options.cwd,
      context
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
  options: RunCommandsBuilderOptions,
): NormalizedRunCommandsBuilderOptions {
  options.parsedArgs = parseArgs(options);

  if (options.command) {
    options.commands = [{ command: options.command }];
    options.parallel = false;
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
      options.cwd,
      context
    );
  }
  return true;
}

/**
 *  @see {https://stackoverflow.com/questions/18894433/nodejs-child-process-working-directory}
 *  @see https://github.com/nodejs/node/issues/11520
 *
 *  The above happen when you call the `nx run ...` command from inside the app
 *  if the app is using the `run-commands` executor and has `cwd` set to
 *  to the app, e.g. `apps/some-app`.
 */
function checkCwd(cwd: string | undefined, context: ExecutorContext): string | undefined {
  if(!cwd) {
    return cwd;
  } else if(path.isAbsolute(cwd)) {
    // absolute is an edge-case i dont know how to deal with
    return cwd;
  }
  const constructedPath = path.join(process.cwd(), cwd)
  if (!pathExistsSync(constructedPath)) {
    return context.root;
  }
  return cwd;
}

function createProcess(
  command: string,
  readyWhen: string,
  color: boolean,
  cwd: string,
  context: ExecutorContext
): Promise<boolean> {
  return new Promise((res) => {
    const childProcess = exec(command, {
      maxBuffer: LARGE_BUFFER,
      env: processEnv(color),
      cwd: checkCwd(cwd, context),
    });
    /**
     * Ensure the child process is killed when the parent exits
     */
    process.on('exit', () => childProcess.kill());
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
    childProcess.on('close', (code) => {
      if (!readyWhen) {
        res(code === 0);
      }
    });
  });
}

function createSyncProcess(
  command: string,
  color: boolean,
  cwd: string,
  context: ExecutorContext
) {
  execSync(command, {
    env: processEnv(color),
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
    cwd: checkCwd(cwd, context),
  });
}

function processEnv(color: boolean) {
  const env = { ...process.env };
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
      .reduce((m, c) => ((m[camelCase(c)] = options[c]), m), {});
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
