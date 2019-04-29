import {
  createBuilder,
  BuilderContext,
  BuilderOutput
} from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import { exec } from 'child_process';
import { JsonObject } from '@angular-devkit/core';

try {
  require('dotenv').config();
} catch (e) {}

export interface RunCommandsBuilderOptions extends JsonObject {
  commands: { command: string }[];
  parallel?: boolean;
  readyWhen?: string;
}

export default createBuilder<RunCommandsBuilderOptions>(run);

function run(
  options: RunCommandsBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  return Observable.create(async observer => {
    if (!options.commands) {
      observer.next({
        success: false,
        error:
          'ERROR: Bad builder config for @nrwl/run-command - "commands" option is required'
      });
      return;
    }

    if (options.readyWhen && !options.parallel) {
      observer.error(
        'ERROR: Bad builder config for @nrwl/run-command - "readyWhen" can only be used when parallel=true'
      );
      return;
    }

    if (options.commands.some(c => !c.command)) {
      observer.error(
        'ERROR: Bad builder config for @nrwl/run-command - "command" option is required'
      );
      return;
    }

    try {
      const success = options.parallel
        ? await runInParallel(options)
        : await runSerially(options, context);
      observer.next({ success });
      observer.complete();
    } catch (e) {
      observer.error(
        `ERROR: Something went wrong in @nrwl/run-command - ${e.message}`
      );
    }
  });
}

async function runInParallel(options: RunCommandsBuilderOptions) {
  const procs = options.commands.map(c =>
    createProcess(c.command, options.readyWhen).then(result => ({
      result,
      command: c.command
    }))
  );

  if (options.readyWhen) {
    const r = await Promise.race(procs);
    if (!r.result) {
      process.stderr.write(
        `Warning: @nrwl/run-command command "${
          r.command
        }" exited with non-zero status code`
      );
      return false;
    } else {
      return true;
    }
  } else {
    const r = await Promise.all(procs);
    const failed = r.filter(v => !v.result);
    if (failed.length > 0) {
      failed.forEach(f => {
        process.stderr.write(
          `Warning: @nrwl/run-command command "${
            f.command
          }" exited with non-zero status code`
        );
      });
      return false;
    } else {
      return true;
    }
  }
}

async function runSerially(
  options: RunCommandsBuilderOptions,
  context: BuilderContext
) {
  const failedCommand = await options.commands.reduce<Promise<string | null>>(
    async (m, c) => {
      if ((await m) === null) {
        const success = await createProcess(c.command, options.readyWhen);
        return !success ? c.command : null;
      } else {
        return m;
      }
    },
    Promise.resolve(null)
  );

  if (failedCommand) {
    context.logger.warn(
      `Warning: @nrwl/run-command command "${failedCommand}" exited with non-zero status code`
    );
    return false;
  }
  return true;
}

function createProcess(command: string, readyWhen: string): Promise<boolean> {
  return new Promise(res => {
    const TEN_MEGABYTES = 1024 * 10000;
    const childProcess = exec(command, { maxBuffer: TEN_MEGABYTES });
    /**
     * Ensure the child process is killed when the parent exits
     */
    process.on('exit', () => childProcess.kill());
    childProcess.stdout.on('data', data => {
      process.stdout.write(data);
      if (readyWhen && data.toString().indexOf(readyWhen) > -1) {
        res(true);
      }
    });
    childProcess.stderr.on('data', err => {
      process.stderr.write(err);
      if (readyWhen && err.toString().indexOf(readyWhen) > -1) {
        res(true);
      }
    });
    childProcess.on('close', code => {
      if (!readyWhen) {
        res(code === 0);
      }
    });
  });
}
