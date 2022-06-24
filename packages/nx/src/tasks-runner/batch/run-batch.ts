import {
  BatchCompleteMessage,
  BatchMessage,
  BatchMessageType,
} from './batch-messages';
import { Workspaces } from '../../config/workspaces';
import { workspaceRoot } from '../../utils/workspace-root';
import { combineOptionsForExecutor } from '../../utils/params';
import { TaskGraph } from '../../config/task-graph';
import { ExecutorContext } from '../../config/misc-interfaces';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from 'nx/src/project-graph/project-graph';

function getBatchExecutor(executorName: string) {
  const workspace = new Workspaces(workspaceRoot);
  const [nodeModule, exportName] = executorName.split(':');
  return workspace.readExecutor(nodeModule, exportName);
}

async function runTasks(executorName: string, taskGraph: TaskGraph) {
  const input: Record<string, any> = {};
  const projectGraph = await createProjectGraphAsync();
  const workspaceConfig =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const batchExecutor = getBatchExecutor(executorName);
  const tasks = Object.values(taskGraph.tasks);
  const context: ExecutorContext = {
    root: workspaceRoot,
    cwd: process.cwd(),
    workspace: workspaceConfig,
    isVerbose: false,
  };
  for (const task of tasks) {
    const projectConfiguration = workspaceConfig.projects[task.target.project];
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
      taskGraph,
      input,
      tasks[0].overrides,
      context
    );

    if (typeof results !== 'object') {
      throw new Error(`"${executorName} returned invalid results: ${results}`);
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
    case BatchMessageType.Tasks: {
      const results = await runTasks(message.executorName, message.taskGraph);
      process.send({
        type: BatchMessageType.Complete,
        results,
      } as BatchCompleteMessage);
      process.exit(0);
    }
  }
});
