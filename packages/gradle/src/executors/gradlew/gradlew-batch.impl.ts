import { ExecutorContext, logger, TaskGraph } from '@nx/devkit';
import {
  LARGE_BUFFER,
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';
import { GraldewExecutorSchema } from './schema';
import { findGraldewFile } from '../../utils/exec-gradle';
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
  const rootGradlewTaskNames = taskGraph.roots.map((root) => {
    const gradlewTaskName = inputs[root].taskName;
    gradlewTaskNameToNxTaskId.set(gradlewTaskName, root);
    return gradlewTaskName;
  });
  try {
    const projectName = taskGraph.tasks[taskGraph.roots[0]]?.target?.project;
    let projectRoot = context.projectGraph.nodes[projectName]?.data?.root ?? '';
    const gradlewPath = findGraldewFile(join(projectRoot, 'project.json')); // find gradlew near project root
    const root = join(context.root, dirname(gradlewPath));

    const input = inputs[taskGraph.roots[0]];
    const args =
      typeof input.args === 'string'
        ? input.args.trim()
        : Array.isArray(input.args)
        ? input.args.join(' ')
        : '';

    const gradlewBatchStart = performance.mark(
      `gradlew-batch:start`
    );
    const batchResults = execSync(
      `java -jar ${batchRunnerPath} --taskNames=${rootGradlewTaskNames.join(
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
    const gradlewBatchEnd = performance.mark(
      `gradlew-batch:start`
    );
    performance.measure(
      `gradlew-batch`,
      gradlewBatchStart.name,
      gradlewBatchEnd.name
    );
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
    

    return mappedResults;
  } catch (e) {
    logger.error(e);
    return taskGraph.roots.reduce((acc, key) => {
      acc[key] = { success: false, terminalOutput: e.toString() };
      return acc;
    }, {} as BatchResults);
  }
}
