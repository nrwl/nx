import {
  Builder,
  BuilderConfiguration,
  BuildEvent
} from '@angular-devkit/architect';

import { Observable } from 'rxjs';
import { exec } from 'child_process';

export interface RunCommandsBuilderOptions {
  commands: { command: string }[];
  parallel?: boolean;
  readyWhen?: string;
}

export default class RunCommandsBuilder
  implements Builder<RunCommandsBuilderOptions> {
  run(
    config: BuilderConfiguration<RunCommandsBuilderOptions>
  ): Observable<BuildEvent> {
    return Observable.create(async observer => {
      if (!config || !config.options || !config.options.commands) {
        observer.error(
          'ERROR: Bad builder config for @nrwl/run-command - "commands" option is required'
        );
        return;
      }

      if (config.options.readyWhen && !config.options.parallel) {
        observer.error(
          'ERROR: Bad builder config for @nrwl/run-command - "readyWhen" can only be used when parallel=true'
        );
        return;
      }

      if (config.options.commands.some(c => !c.command)) {
        observer.error(
          'ERROR: Bad builder config for @nrwl/run-command - "command" option is required'
        );
        return;
      }

      try {
        const success = config.options.parallel
          ? await this.runInParallel(config)
          : await this.runSerially(config);
        observer.next({ success });
        observer.complete();
      } catch (e) {
        observer.error(
          `ERROR: Something went wrong in @nrwl/run-command - ${e.message}`
        );
      }
    });
  }

  private async runInParallel(
    config: BuilderConfiguration<RunCommandsBuilderOptions>
  ) {
    const procs = config.options.commands.map(c =>
      this.createProcess(c.command, config.options.readyWhen).then(result => ({
        result,
        command: c.command
      }))
    );

    if (config.options.readyWhen) {
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

  private async runSerially(
    config: BuilderConfiguration<RunCommandsBuilderOptions>
  ) {
    const failedCommand = await config.options.commands.reduce<
      Promise<string | null>
    >(async (m, c) => {
      if ((await m) === null) {
        const success = await this.createProcess(
          c.command,
          config.options.readyWhen
        );
        return !success ? c.command : null;
      } else {
        return m;
      }
    }, Promise.resolve(null));

    if (failedCommand) {
      process.stderr.write(
        `Warning: @nrwl/run-command command "${failedCommand}" exited with non-zero status code`
      );
      return false;
    }
    return true;
  }

  private createProcess(command: string, readyWhen: string): Promise<boolean> {
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
}
