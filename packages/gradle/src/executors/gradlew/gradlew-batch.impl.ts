import { ExecutorContext, logger, output, TaskGraph } from '@nx/devkit';
import {
  LARGE_BUFFER,
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';
import { GraldewExecutorSchema } from './schema';
import { findGradlewFile } from '../../utils/exec-gradle';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

export const batchRunnerPath = join(
  __dirname,
  '../../../batch-runner/build/libs/nx-batch-runner.jar'
);
export default async function gradlewBatch(
  taskGraph: TaskGraph,
  inputs: Record<string, GraldewExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): Promise<BatchResults> {
  const gradlewTaskNameToNxTaskId = new Map<string, string>();
  const gradlewTaskNames = Object.keys(taskGraph.tasks).map(
    (taskId: string) => {
      const gradlewTaskName = inputs[taskId].taskName;
      gradlewTaskNameToNxTaskId.set(gradlewTaskName, taskId);
      return gradlewTaskName;
    }
  );
  try {
    const projectName = taskGraph.tasks[taskGraph.roots[0]]?.target?.project;
    let projectRoot = context.projectGraph.nodes[projectName]?.data?.root ?? '';
    const gradlewPath = findGradlewFile(join(projectRoot, 'project.json')); // find gradlew near project root
    const root = join(context.root, dirname(gradlewPath));

    const input = inputs[taskGraph.roots[0]];
    const args =
      typeof input.args === 'string'
        ? input.args.trim()
        : Array.isArray(input.args)
        ? input.args.join(' ')
        : '';

    console.log(`Running gradlew batch with args: ${args}`);
    output.log({
      title: `Running gradlew batch with args: ${args}`,
      bodyLines: gradlewTaskNames,
    });
    const gradlewBatchStart = performance.mark(`gradlew-batch:start`);
    const batchResults = execSync(
      `java -jar ${batchRunnerPath} --taskNames=${gradlewTaskNames.join(
        ','
      )} --workspaceRoot=${root} ${args ? '--args=' + args : ''} ${
        process.env.NX_VERBOSE_LOGGING === 'true' ? '' : '--quiet'
      }`,
      {
        windowsHide: true,
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      }
    );
    const gradlewBatchEnd = performance.mark(`gradlew-batch:end`);
    const duration = performance.measure(
      `gradlew-batch`,
      gradlewBatchStart.name,
      gradlewBatchEnd.name
    );
    if (process.env.NX_PERF_LOGGING === 'true') {
      console.log(`Time for 'gradlew-batch'`, duration.duration);
    }
    const gradlewBatchResults = JSON.parse(
      batchResults.toString()
    ) as BatchResults;

    // Replace keys in gradlewBatchResults with gradlewTaskNameToNxTaskId values
    const mappedResults = Object.keys(gradlewBatchResults).reduce(
      (acc, key) => {
        const nxTaskId = gradlewTaskNameToNxTaskId.get(key);
        if (nxTaskId) {
          acc[nxTaskId] = gradlewBatchResults[key];
        }
        return acc;
      },
      {} as BatchResults
    );

    console.log(`Gradlew batch completed with results`);
    logger.info(`Gradlew batch completed with results`);
    return mappedResults;
  } catch (e) {
    logger.error(e);
    console.error(e);
    output.error({
      title: `Gradlew batch failed`,
      bodyLines: [e.toString()],
    });
    return taskGraph.roots.reduce((acc, key) => {
      acc[key] = { success: false, terminalOutput: e.toString() };
      return acc;
    }, {} as BatchResults);
  }
}
