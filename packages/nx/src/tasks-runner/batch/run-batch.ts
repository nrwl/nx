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
import { parseMessage } from '../../utils/consume-messages-from-socket';
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

// The channel uses advanced serialization, which rejects values JSON used to
// drop silently, such as a function on a third-party executor's result.
function sendToRunner(
  message: CompleteTaskMessage | CompleteBatchExecutionMessage
) {
  try {
    process.send(message);
  } catch {
    process.send(JSON.parse(JSON.stringify(message)));
  }
}

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
          sendToRunner({
            type: BatchMessageType.CompleteTask,
            task: current.value.task,
            result: current.value.result,
          });
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

function decodeTaskGraph(graph: TaskGraph | Buffer): TaskGraph {
  return Buffer.isBuffer(graph) ? parseMessage<TaskGraph>(graph) : graph;
}

process.on('message', async (message: BatchMessage) => {
  switch (message.type) {
    case BatchMessageType.RunTasks: {
      // runTasks reports its own failures; this covers decoding the graphs
      // and replying, which would otherwise die as an unhandled rejection.
      try {
        const results = await runTasks(
          message.executorName,
          message.projectGraph,
          decodeTaskGraph(message.batchTaskGraph),
          decodeTaskGraph(message.fullTaskGraph)
        );
        sendToRunner({
          type: BatchMessageType.CompleteBatchExecution,
          results,
        });
      } catch (e) {
        console.error(
          `Batch ${message.executorName} failed before it could report results: ${e.message}`
        );
        process.exit(1);
      }
    }
  }
});
