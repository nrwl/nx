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
  '../../../batch-runner/build/libs/batch-runner-all.jar'
);

interface GradlewTask {
  taskName: string;
  testClassName: string;
}

export default async function gradlewBatch(
  taskGraph: TaskGraph,
  inputs: Record<string, GraldewExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): Promise<BatchResults> {
  try {
    const projectName = taskGraph.tasks[taskGraph.roots[0]]?.target?.project;
    let projectRoot = context.projectGraph.nodes[projectName]?.data?.root ?? '';
    const gradlewPath = findGradlewFile(join(projectRoot, 'project.json')); // find gradlew near project root
    const root = join(context.root, dirname(gradlewPath));

    // set args with passed in args and overrides in command line
    const input = inputs[taskGraph.roots[0]];
    let args =
      typeof input.args === 'string'
        ? input.args.trim()
        : Array.isArray(input.args)
        ? input.args.join(' ')
        : '';
    args += overrides.__overrides_unparsed__.length
      ? ' ' + overrides.__overrides_unparsed__.join(' ')
      : '';

    const gradlewTasksToRun: Record<string, GradlewTask> = Object.entries(
      taskGraph.tasks
    ).reduce((gradlewTasksToRun, [taskId, task]) => {
      const gradlewTaskName = inputs[task.id].taskName;
      const testClassName = inputs[task.id].testClassName;
      gradlewTasksToRun[taskId] = {
        taskName: gradlewTaskName,
        testClassName: testClassName,
      };
      return gradlewTasksToRun;
    }, {});
    console.log(`Running gradlew batch with args: ${args}`);
    output.log({
      title: `Running gradlew batch with args: ${args}`,
      bodyLines: Object.keys(gradlewTasksToRun),
    });
    const gradlewBatchStart = performance.mark(`gradlew-batch:start`);
    const batchResults = execSync(
      `java -jar ${batchRunnerPath} --tasks='${JSON.stringify(
        gradlewTasksToRun
      )}' --workspaceRoot=${root} --args='${args}' ${
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

    Object.keys(taskGraph.tasks).forEach((taskId) => {
      if (!gradlewBatchResults[taskId]) {
        gradlewBatchResults[taskId] = {
          success: false,
          terminalOutput: `Gradlew batch failed`,
        };
      }
    });

    return gradlewBatchResults;
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
