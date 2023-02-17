import { workspaceConfigurationCheck } from '../utils/workspace-configuration-check';
import { readNxJson } from '../config/configuration';
import { NxArgs } from '../utils/command-line-utils';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { invokeTasksRunner } from './run-command';
import { InvokeRunnerTerminalOutputLifeCycle } from './life-cycles/invoke-runner-terminal-output-life-cycle';
import { performance } from 'perf_hooks';

export async function initTasksRunner(nxArgs: NxArgs) {
  performance.mark('init-local');
  workspaceConfigurationCheck();
  const nxJson = readNxJson();
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  return {
    invoke: async (
      tasks: Task[]
    ): Promise<{ status: number; taskGraph: TaskGraph }> => {
      performance.mark('command-execution-begins');
      const lifeCycle = new InvokeRunnerTerminalOutputLifeCycle(tasks);

      const taskGraph = {
        roots: tasks.map((task) => task.id),
        tasks: tasks.reduce((acc, task) => {
          acc[task.id] = task;
          return acc;
        }, {} as any),
        dependencies: tasks.reduce((acc, task) => {
          acc[task.id] = [];
          return acc;
        }, {} as any),
      };

      const status = await invokeTasksRunner({
        tasks,
        projectGraph,
        taskGraph,
        lifeCycle,
        nxJson,
        nxArgs,
        loadDotEnvFiles: true,
        initiatingProject: null,
      });

      return {
        status,
        taskGraph,
      };
    },
  };
}
