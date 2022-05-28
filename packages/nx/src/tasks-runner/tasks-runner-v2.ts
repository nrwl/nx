import {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
} from './default-tasks-runner';
import { TaskStatus } from './tasks-runner';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task } from '../config/task-graph';
import { NxArgs } from '../utils/command-line-utils';

export { DefaultTasksRunnerOptions, RemoteCache } from './default-tasks-runner';

/**
 * TODO: Remove after NX 15 is released
 * This tasks runner converts the new implementation of the default tasks runner
 * to the old Observable-based API.
 *
 * It is going to be removed after Nx 15 is released.
 */
export const tasksRunnerV2 = (
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    target: string;
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
  }
): any => {
  if (!options.lifeCycle.startCommand) {
    throw new Error(
      `If you are using Nx Cloud, update the version of @nrwl/nx-cloud to >=13.0.0`
    );
  }

  const { Subject } = require('rxjs/internal/Subject');
  const r = new Subject();
  (defaultTasksRunner(tasks, options, context) as any)
    .then((tasks: { [id: string]: TaskStatus }) => {
      convertCompletedTasksToOutputFormat(tasks).forEach((k) => r.next(k));
      r.complete();
    })
    .catch((e) => {
      r.error(e);
      r.complete();
    });

  return r;
};

function convertCompletedTasksToOutputFormat(completedTasks: {
  [id: string]: TaskStatus;
}) {
  return Object.keys(completedTasks).map((taskId): any => {
    const taskStatus = completedTasks[taskId];
    return {
      success:
        taskStatus === 'success' ||
        (taskStatus as any) === 'cache' ||
        taskStatus === 'local-cache' ||
        taskStatus === 'local-cache-kept-existing' ||
        taskStatus === 'remote-cache',
    };
  });
}

export default tasksRunnerV2;
