import {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
} from './default-tasks-runner';
import { TaskStatus } from './tasks-runner';
import { Subject } from 'rxjs/internal/Subject';
import type { Observable } from 'rxjs';
import { ProjectGraph } from '../shared/project-graph';
import { NxJsonConfiguration } from '../shared/nx';
import { Task } from '../shared/tasks';

export { DefaultTasksRunnerOptions, RemoteCache } from './default-tasks-runner';

/**
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
  }
): Observable<any> => {
  if (!options.lifeCycle.startCommand) {
    throw new Error(
      `If you are using Nx Cloud, update the version of @nrwl/nx-cloud to >=13.0.0`
    );
  }

  const r = new Subject<any>();
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
