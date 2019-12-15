import * as runAll from 'npm-run-all';
import { Observable } from 'rxjs';
import { basename } from 'path';
import {
  AffectedEventType,
  Task,
  TaskCompleteEvent,
  TasksRunner
} from './tasks-runner';
import { output } from '../utils/output';
import { readJsonFile } from '../utils/fileutils';
import { getCommand } from './utils';
import { cliCommand } from '../core/file-utils';

export interface DefaultTasksRunnerOptions {
  parallel?: boolean;
  maxParallel?: number;
}

export const defaultTasksRunner: TasksRunner<DefaultTasksRunnerOptions> = (
  tasks: Task[],
  options: DefaultTasksRunnerOptions
): Observable<TaskCompleteEvent> => {
  const cli = cliCommand();
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  assertPackageJsonScriptExists(cli);
  const commands = tasks.map(t => getCommand(cli, isYarn, t));
  return new Observable(subscriber => {
    runAll(commands, {
      parallel: options.parallel || false,
      maxParallel: options.maxParallel || 3,
      continueOnError: true,
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    })
      .then(() => {
        tasks.forEach(task => {
          subscriber.next({
            task: task,
            type: AffectedEventType.TaskComplete,
            success: true
          });
        });
      })
      .catch(e => {
        e.results.forEach((result, i) => {
          subscriber.next({
            task: tasks[i],
            type: AffectedEventType.TaskComplete,
            success: result.code === 0
          });
        });
      })
      .finally(() => {
        subscriber.complete();
        // fix for https://github.com/nrwl/nx/issues/1666
        if (process.stdin['unref']) (process.stdin as any).unref();
      });
  });
};

function assertPackageJsonScriptExists(cli: string) {
  // Make sure the `package.json` has the `nx: "nx"` command needed by `npm-run-all`
  const packageJson = readJsonFile('./package.json');
  if (!packageJson.scripts || !packageJson.scripts[cli]) {
    output.error({
      title: `The "scripts" section of your 'package.json' must contain "${cli}": "${cli}"`,
      bodyLines: [
        output.colors.gray('...'),
        ' "scripts": {',
        output.colors.gray('  ...'),
        `   "${cli}": "${cli}"`,
        output.colors.gray('  ...'),
        ' }',
        output.colors.gray('...')
      ]
    });
    return process.exit(1);
  }
}

export default defaultTasksRunner;
