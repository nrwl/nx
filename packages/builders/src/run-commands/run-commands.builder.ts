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
    const r = await Promise.all(
      config.options.commands.map(c =>
        this.createProcess(c.command).then(result => ({
          result,
          command: c.command
        }))
      )
    );
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

  private async runSerially(
    config: BuilderConfiguration<RunCommandsBuilderOptions>
  ) {
    const failedCommand = await config.options.commands.reduce<
      Promise<string | null>
    >(async (m, c) => {
      if ((await m) === null) {
        const success = await this.createProcess(c.command);
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

  private createProcess(command: string): Promise<boolean> {
    return new Promise(res => {
      const childProcess = exec(command, {});
      childProcess.stdout.on('data', data => process.stdout.write(data));
      childProcess.stderr.on('data', err => process.stderr.write(err));
      childProcess.on('close', code => {
        res(code === 0);
      });
    });
  }
}
