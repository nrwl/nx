import {
  BatchCompleteMessage,
  BatchMessage,
  BatchMessageType,
} from './batch-messages';
import { TaskGraph } from '@nrwl/devkit';
import { ExecutorContext, Workspaces } from '@nrwl/tao/src/shared/workspace';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { combineOptionsForExecutor } from '@nrwl/tao/src/shared/params';

function getBatchExecutor(executorName: string) {
  const workspace = new Workspaces(appRootPath);
  const [nodeModule, exportName] = executorName.split(':');
  return workspace.readExecutor(nodeModule, exportName);
}

async function runTasks(executorName: string, taskGraph: TaskGraph) {
  const input: Record<string, any> = {};
  const workspace = new Workspaces(appRootPath);
  const workspaceConfig = workspace.readWorkspaceConfiguration();
  const nxJsonConfig = workspace.readNxConfiguration();

  const batchExecutor = getBatchExecutor(executorName);
  const tasks = Object.values(taskGraph.tasks);
  const context: ExecutorContext = {
    root: appRootPath,
    cwd: process.cwd(),
    workspace: workspaceConfig,
    nxJson: nxJsonConfig,
    isVerbose: false,
  };
  for (const task of tasks) {
    const projectConfiguration =
      workspace.readWorkspaceConfiguration().projects[task.target.project];
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
