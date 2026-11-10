import {
  CompleteBatchExecutionMessage,
  BatchMessage,
  BatchMessageType,
  CompleteTaskMessage,
  BatchResults,
} from './batch-messages';
import { workspaceRoot } from '../../utils/workspace-root';
import { combineOptionsForExecutor, Options } from '../../utils/params';
import { TaskGraph } from '../../config/task-graph';
import { ExecutorContext } from '../../config/misc-interfaces';
import { readProjectsConfigurationFromProjectGraph } from '../../project-graph/project-graph';
import { readNxJson } from '../../config/configuration';
import { isAsyncIterator } from '../../utils/async-iterator';
import {
  getExecutorInformation,
  parseExecutor,
} from '../../command-line/run/executor-utils';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { ProjectGraph } from '../../config/project-graph';

// Batch workers are inside an Nx run just like task workers (see
// bin/run-executor.ts) — mark it so nested tooling can detect Nx.
process.env.NX_CLI_SET = 'true';

function getBatchExecutor(
  executorName: string,
  projects: Record<string, ProjectConfiguration>
) {
  const [nodeModule, exportName] = parseExecutor(executorName);
  return getExecutorInformation(
    nodeModule,
    exportName,
    workspaceRoot,
    projects
  );
}

async function runTasks(
  executorName: string,
  projectGraph: ProjectGraph,
  batchTaskGraph: TaskGraph,
  fullTaskGraph: TaskGraph
) {
  const input: Record<string, any> = {};
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const nxJsonConfiguration = readNxJson();
  const batchExecutor = getBatchExecutor(
    executorName,
    projectsConfigurations.projects
  );
  const tasks = Object.values(batchTaskGraph.tasks);
  const context: ExecutorContext = {
    root: workspaceRoot,
    cwd: process.cwd(),
    projectsConfigurations,
    nxJsonConfiguration,
    isVerbose: false,
    projectGraph,
    taskGraph: fullTaskGraph,
  };
  for (const task of tasks) {
    const projectConfiguration =
      projectsConfigurations.projects[task.target.project];
    const targetConfiguration =
      projectConfiguration.targets[task.target.target];
    input[task.id] = combineOptionsForExecutor(
      task.overrides as Options,
      task.target.configuration,
      targetConfiguration,
      batchExecutor.schema,
      null,
      process.cwd()
    );
  }

  try {
    const results = await batchExecutor.batchImplementationFactory()(
      batchTaskGraph,
      input,
      tasks[tasks.length - 1].overrides,
      context
    );

    if (typeof results !== 'object') {
      throw new Error(`"${executorName} returned invalid results: ${results}`);
    }

    if (isAsyncIterator(results)) {
      const batchResults: BatchResults = {};

      do {
        const current = await results.next();

        if (!current.done) {
          batchResults[current.value.task] = current.value.result;
          process.send({
            type: BatchMessageType.CompleteTask,
            task: current.value.task,
            result: current.value.result,
          } as CompleteTaskMessage);
        } else {
          break;
        }
      } while (true);

      return batchResults;
    }

    return results;
  } catch (e) {
    const isVerbose = tasks[0].overrides.verbose;
    console.error(isVerbose ? e : e.message);
    // `process.exit` does not wait for pipe writes, so the reason this worker
    // died could otherwise be the one line that never arrives.
    await flushStdio();
    process.exit(1);
  }
}

/**
 * Waits until everything written to stdout and stderr so far has reached the
 * pipe. Writes to a pipe are asynchronous, and the parent learns the batch is
 * over through a separate IPC channel - so without this it can be told the batch
 * finished, or see the process exit, while the end of its output is still in
 * memory here. That tail is where a tool reports what went wrong.
 */
function flushStdio(): Promise<void> {
  const flush = (stream: NodeJS.WriteStream) =>
    new Promise<void>((resolve) => stream.write('', () => resolve()));
  return Promise.all([flush(process.stdout), flush(process.stderr)]).then(
    () => undefined
  );
}

process.on('message', async (message: BatchMessage) => {
  switch (message.type) {
    case BatchMessageType.RunTasks: {
      const results = await runTasks(
        message.executorName,
        message.projectGraph,
        message.batchTaskGraph,
        message.fullTaskGraph
      );
      await flushStdio();
      process.send({
        type: BatchMessageType.CompleteBatchExecution,
        results,
      } as CompleteBatchExecutionMessage);
    }
  }
});
