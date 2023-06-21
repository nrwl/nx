import {
  CompleteBatchExecutionMessage,
  BatchMessage,
  BatchMessageType,
  CompleteTaskMessage,
  BatchResults,
} from './batch-messages';
import { Workspaces } from '../../config/workspaces';
import { workspaceRoot } from '../../utils/workspace-root';
import { combineOptionsForExecutor } from '../../utils/params';
import { TaskGraph } from '../../config/task-graph';
import { ExecutorContext } from '../../config/misc-interfaces';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { readNxJson } from '../../config/configuration';
import { isAsyncIterator } from '../../utils/async-iterator';

function getBatchExecutor(executorName: string) {
  const workspace = new Workspaces(workspaceRoot);
  const [nodeModule, exportName] = executorName.split(':');
  return workspace.readExecutor(nodeModule, exportName);
}

async function runTasks(
  executorName: string,
  batchTaskGraph: TaskGraph,
  fullTaskGraph: TaskGraph
) {
  const input: Record<string, any> = {};
  const projectGraph = await createProjectGraphAsync();
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const nxJsonConfiguration = readNxJson();
  const batchExecutor = getBatchExecutor(executorName);
  const tasks = Object.values(batchTaskGraph.tasks);
  const context: ExecutorContext = {
    root: workspaceRoot,
    cwd: process.cwd(),
    projectsConfigurations,
    nxJsonConfiguration,
    workspace: { ...projectsConfigurations, ...nxJsonConfiguration },
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
      task.overrides,
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
      tasks[0].overrides,
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
    process.exit(1);
  }
}

process.on('message', async (message: BatchMessage) => {
  switch (message.type) {
    case BatchMessageType.RunTasks: {
      const results = await runTasks(
        message.executorName,
        message.batchTaskGraph,
        message.fullTaskGraph
      );
      process.send({
        type: BatchMessageType.CompleteBatchExecution,
        results,
      } as CompleteBatchExecutionMessage);
    }
  }
});
