import { ExecutorContext, output, TaskGraph, workspaceRoot } from '@nx/devkit';
import {
  LARGE_BUFFER,
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';
import { GradleExecutorSchema } from './schema';
import { findGradlewFile } from '../../utils/exec-gradle';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import {
  createPseudoTerminal,
  PseudoTerminal,
} from 'nx/src/tasks-runner/pseudo-terminal';
import { getAllDependsOn, getExcludeTasks } from './get-exclude-task';

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
  inputs: Record<string, GradleExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): Promise<BatchResults> {
  try {
    const projectName = taskGraph.tasks[taskGraph.roots[0]]?.target?.project;
    let projectRoot = context.projectGraph.nodes[projectName]?.data?.root ?? '';
    let gradlewPath = findGradlewFile(join(projectRoot, 'project.json')); // find gradlew near project root
    gradlewPath = join(context.root, gradlewPath);
    const root = dirname(gradlewPath);

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

    const taskIdsWithExclude = [];
    const taskIdsWithoutExclude = [];

    const taskIds = Object.keys(taskGraph.tasks);
    for (const taskId of taskIds) {
      if (inputs[taskId].excludeDependsOn) {
        taskIdsWithExclude.push(taskId);
      } else {
        taskIdsWithoutExclude.push(taskId);
      }
    }

    const allDependsOn = new Set<string>(taskIds);
    taskIdsWithoutExclude.forEach((taskId) => {
      const [projectName, targetName] = taskId.split(':');
      const dependencies = getAllDependsOn(
        context.projectGraph,
        projectName,
        targetName
      );
      dependencies.forEach((dep) => allDependsOn.add(dep));
    });

    const gradlewTasksToRun: Record<string, GradleTask> = taskIds.reduce(
      (gradlewTasksToRun, taskId) => {
        const task = taskGraph.tasks[taskId];
        const gradlewTaskName = inputs[task.id].taskName;
        const testClassName = inputs[task.id].testClassName;
        gradlewTasksToRun[taskId] = {
          taskName: gradlewTaskName,
          testClassName: testClassName,
        };
        return gradlewTasksToRun;
      },
      {}
    );

    const excludeTasks = getExcludeTasks(
      context.projectGraph,
      taskIdsWithExclude.map((taskId) => {
        const task = taskGraph.tasks[taskId];
        return {
          project: task?.target?.project,
          target: task?.target?.target,
          excludeDependsOn: inputs[taskId]?.excludeDependsOn,
        };
      }),
      allDependsOn
    );

    const batchResults = await runTasksInBatch(
      gradlewTasksToRun,
      excludeTasks,
      args,
      root
    );

    taskIds.forEach((taskId) => {
      if (!batchResults[taskId]) {
        batchResults[taskId] = {
          success: false,
          terminalOutput: `Gradlew batch failed`,
        };
      }
    });

    return batchResults;
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

async function runTasksInBatch(
  gradlewTasksToRun: Record<string, GradleTask>,
  excludeTasks: Set<string>,
  args: string[],
  root: string
): Promise<BatchResults> {
  const gradlewBatchStart = performance.mark(`gradlew-batch:start`);

  const usePseudoTerminal =
    process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
    PseudoTerminal.isSupported();
  const command = `java -jar ${batchRunnerPath} --tasks='${JSON.stringify(
    gradlewTasksToRun
  )}' --workspaceRoot=${root} --args='${args
    .join(' ')
    .replaceAll("'", '"')}' --excludeTasks='${Array.from(excludeTasks).join(
    ','
  )}' ${process.env.NX_VERBOSE_LOGGING === 'true' ? '' : '--quiet'}`;
  let batchResults;
  if (usePseudoTerminal && process.env.NX_VERBOSE_LOGGING !== 'true') {
    const terminal = createPseudoTerminal();
    await terminal.init();

    const cp = terminal.runCommand(command, {
      cwd: workspaceRoot,
      jsEnv: process.env,
      quiet: true,
    });
    const results = await cp.getResults();
    terminal.shutdown(0);
    batchResults = results.terminalOutput;

    batchResults = batchResults.replace(command, '');
    const startIndex = batchResults.indexOf('{');
    const endIndex = batchResults.lastIndexOf('}');
    // only keep the json part
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
  const gradlewBatchResults = JSON.parse(batchResults) as BatchResults;

  return gradlewBatchResults;
}
