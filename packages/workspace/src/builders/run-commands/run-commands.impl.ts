import { BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { exec, execSync } from 'child_process';
import { Observable } from 'rxjs';

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

export interface RunCommandsBuilderOptions extends JsonObject {
  command: string;
  commands: ({ command: string } | string)[];
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
  commands: { command: string }[];
  parsedArgs: { [k: string]: any };
}

export default createBuilder<RunCommandsBuilderOptions>(run);

function run(options: RunCommandsBuilderOptions): Observable<BuilderOutput> {
  loadEnvVars(options.envFile);
  const normalized = normalizeOptions(options);

  return Observable.create(async (observer) => {
    if (options.readyWhen && !options.parallel) {
      observer.error(
        'ERROR: Bad builder config for @nrwl/run-commands - "readyWhen" can only be used when parallel=true'
      );
      return;
    }

    try {
      const success = options.parallel
        ? await runInParallel(normalized)
        : await runSerially(normalized);
      observer.next({ success });
      observer.complete();
    } catch (e) {
      observer.error(
        `ERROR: Something went wrong in @nrwl/run-commands - ${e.message}`
      );
    }
  });
}

async function runInParallel(options: NormalizedRunCommandsBuilderOptions) {
  const procs = options.commands.map((c) =>
    createProcess(
      c.command,
      options.readyWhen,
      options.color,
      options.cwd
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
    options.parallel = false;
  } else {
    options.commands = options.commands.map((c) =>
      typeof c === 'string' ? { command: c } : c
    );
  }
  (options as NormalizedRunCommandsBuilderOptions).commands.forEach((c) => {
    c.command = transformCommand(
      c.command,
      (options as NormalizedRunCommandsBuilderOptions).parsedArgs
    );
  });
  return options as any;
}

async function runSerially(options: NormalizedRunCommandsBuilderOptions) {
  options.commands.forEach((c) => {
    createSyncProcess(c.command, options.color, options.cwd);
  });
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

function createSyncProcess(command: string, color: boolean, cwd: string) {
  execSync(command, {
    env: processEnv(color),
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
    cwd,
  });
}

function processEnv(color: boolean) {
  const env = { ...process.env };
  if (color) {
    env.FORCE_COLOR = `${color}`;
  }
  return env;
}

function transformCommand(command: string, args: { [key: string]: string }) {
  if (command.indexOf('{args.') > -1) {
    const regex = /{args\.([^}]+)}/g;
    return command.replace(regex, (_, group: string) => args[group]);
  } else if (Object.keys(args).length > 0) {
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
  return args
    .split(' ')
    .map((t) => t.trim())
    .reduce((m, c) => {
      if (!c.startsWith('--')) {
        throw new Error(`Invalid args: ${args}`);
      }
      const [key, value] = c.substring(2).split('=');
      if (!key || !value) {
        throw new Error(`Invalid args: ${args}`);
      }
      m[key] = value;
      return m;
    }, {});
}
