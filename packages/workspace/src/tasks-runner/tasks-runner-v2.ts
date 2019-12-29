import { Observable } from 'rxjs';
import {
  AffectedEventType,
  Task,
  TaskCompleteEvent,
  TasksRunner
} from './tasks-runner';
import { output } from '../utils/output';
import { readJsonFile } from '../utils/fileutils';
import { cliCommand } from '../core/file-utils';
import { ProjectGraph } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';
import { TaskOrderer } from './task-orderer';
import { TaskOrchestrator } from './task-orchestrator';

export interface RemoteCache {
  retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
  store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}

export interface DefaultTasksRunnerOptions {
  parallel?: boolean;
  maxParallel?: number;
  cacheableOperations?: string[];
  cacheDirectory?: string;
  remoteCache?: RemoteCache;
}

export const tasksRunnerV2: TasksRunner<DefaultTasksRunnerOptions> = (
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: { target: string; projectGraph: ProjectGraph; nxJson: NxJson }
): Observable<TaskCompleteEvent> => {
  return new Observable(subscriber => {
    runAllTasks(tasks, options, context)
      .then(data => data.forEach(d => subscriber.next(d)))
      .catch(e => {
        console.error('Unexpected error:');
        console.error(e);
        process.exit(1);
      })
      .finally(() => {
        subscriber.complete();
        // fix for https://github.com/nrwl/nx/issues/1666
        if (process.stdin['unref']) (process.stdin as any).unref();
      });
  });
};

async function runAllTasks(
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: { target: string; projectGraph: ProjectGraph; nxJson: NxJson }
): Promise<Array<{ task: Task; type: any; success: boolean }>> {
  assertPackageJsonScriptExists();
  const stages = new TaskOrderer(
    context.target,
    context.projectGraph
  ).splitTasksIntoStages(tasks);

  const orchestrator = new TaskOrchestrator(
    context.nxJson,
    context.projectGraph,
    options
  );

  const res = [];
  for (let i = 0; i < stages.length; ++i) {
    const tasksInStage = stages[i];
    const statuses = await orchestrator.run(tasksInStage);
    res.push(...statuses);

    // any task failed, we need to skip further stages
    if (statuses.find(s => !s.success)) {
      res.push(...markStagesAsNotSuccessful(stages.splice(i + 1)));
      return res;
    }
  }
  return res;
}

function markStagesAsNotSuccessful(stages: Task[][]) {
  return stages.reduce((m, c) => [...m, ...tasksToStatuses(c, false)], []);
}

function tasksToStatuses(tasks: Task[], success: boolean) {
  return tasks.map(task => ({
    task,
    type: AffectedEventType.TaskComplete,
    success
  }));
}

function assertPackageJsonScriptExists() {
  const cli = cliCommand();
  // Make sure the `package.json` has the `nx: "nx"`
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

export default tasksRunnerV2;
