import { ExecutorContext, output, TaskGraph, workspaceRoot } from '@nx/devkit';
import {
  LARGE_BUFFER,
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';
import { gradleExecutorSchema } from './schema';
import { findGradlewFile } from '../../utils/exec-gradle';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import {
  createPseudoTerminal,
  PseudoTerminal,
} from 'nx/src/tasks-runner/pseudo-terminal';

export const batchRunnerPath = join(
  __dirname,
  '../../../batch-runner/build/libs/batch-runner-all.jar'
);

interface GradleTask {
  taskName: string;
  testClassName: string;
}

export default async function gradleBatch(
  taskGraph: TaskGraph,
  inputs: Record<string, gradleExecutorSchema>,
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
        ? input.args.trim().split(' ')
        : Array.isArray(input.args)
        ? input.args
        : [];
    if (overrides.__overrides_unparsed__.length) {
      args.push(...overrides.__overrides_unparsed__);
    }

    const gradlewTasksToRun: Record<string, GradleTask> = Object.entries(
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
    const gradlewBatchStart = performance.mark(`gradlew-batch:start`);

    const usePseudoTerminal =
      process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
      PseudoTerminal.isSupported();
    const command = `java -jar ${batchRunnerPath} --tasks='${JSON.stringify(
      gradlewTasksToRun
    )}' --workspaceRoot=${root} --args='${args
      .join(' ')
      .replaceAll("'", '"')}' ${
      process.env.NX_VERBOSE_LOGGING === 'true' ? '' : '--quiet'
    }`;
    let batchResults;
    if (usePseudoTerminal) {
      const terminal = createPseudoTerminal();
      await terminal.init();

      const cp = terminal.runCommand(command, {
        cwd: workspaceRoot,
        jsEnv: process.env,
        quiet: process.env.NX_VERBOSE_LOGGING !== 'true',
      });
      const results = await cp.getResults();
      batchResults = results.terminalOutput;

      batchResults = batchResults.replace(command, '');
      const startIndex = batchResults.indexOf('{');
      const endIndex = batchResults.lastIndexOf('}');
      batchResults = batchResults.substring(startIndex, endIndex + 1);
    } else {
      batchResults = execSync(command, {
        cwd: workspaceRoot,
        windowsHide: true,
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      }).toString();
    }
    const gradlewBatchEnd = performance.mark(`gradlew-batch:end`);
    performance.measure(
      `gradlew-batch`,
      gradlewBatchStart.name,
      gradlewBatchEnd.name
    );
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
