import {
  ExecutorContext,
  output,
  ProjectGraphProjectNode,
  Target,
  TaskGraph,
  workspaceRoot,
} from '@nx/devkit';
import {
  LARGE_BUFFER,
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';
import { GradleExecutorSchema } from './schema';
import {
  findGradlewFile,
  getCustomGradleExecutableDirectoryFromPlugin,
} from '../../utils/exec-gradle';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import {
  getAllDependsOn,
  getExcludeTasks,
  getGradleTaskName,
} from './get-exclude-task';
import { GradlePluginOptions } from '../../plugin/utils/gradle-plugin-options';

export const batchRunnerPath = join(
  __dirname,
  '../../../batch-runner/build/libs/gradle-batch-runner-all.jar'
);

export default async function gradleBatch(
  taskGraph: TaskGraph,
  inputs: Record<string, GradleExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): Promise<BatchResults> {
  try {
    const projectName = taskGraph.tasks[taskGraph.roots[0]]?.target?.project;
    let projectRoot = context.projectGraph.nodes[projectName]?.data?.root ?? '';
    const customGradleExecutableDirectory =
      getCustomGradleExecutableDirectoryFromPlugin(context.nxJsonConfiguration);

    let gradlewPath = findGradlewFile(
      join(projectRoot, 'project.json'),
      workspaceRoot,
      customGradleExecutableDirectory
    ); // find gradlew near project root
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

    const taskIds = Object.keys(taskGraph.tasks);

    const { gradlewTasksToRun, excludeTasks, excludeTestTasks } =
      getGradlewTasksToRun(
        taskIds,
        taskGraph,
        inputs,
        context.projectGraph.nodes
      );

    const batchResults = await runTasksInBatch(
      gradlewTasksToRun,
      excludeTasks,
      excludeTestTasks,
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

/**
 * Get the gradlew task ids to run
 */
export function getGradlewTasksToRun(
  taskIds: string[],
  taskGraph: TaskGraph,
  inputs: Record<string, GradleExecutorSchema>,
  nodes: Record<string, ProjectGraphProjectNode>
) {
  const tasksWithExclude: Set<Target> = new Set();
  const testTasksWithExclude: Set<Target> = new Set();
  const tasksWithoutExclude: Set<Target> = new Set();
  const gradlewTasksToRun: Record<string, GradleExecutorSchema> = {};
  const includeDependsOnTasks: Set<string> = new Set();

  for (const taskId of taskIds) {
    const task = taskGraph.tasks[taskId];
    const input = inputs[task.id];
    const taskTarget: Target = {
      project: task.target.project,
      target: task.target.target,
    };

    gradlewTasksToRun[taskId] = input;

    if (input.includeDependsOnTasks) {
      for (const t of input.includeDependsOnTasks) {
        includeDependsOnTasks.add(t);
      }
    }

    if (input.excludeDependsOn) {
      if (input.testClassName) {
        testTasksWithExclude.add(taskTarget);
      } else {
        tasksWithExclude.add(taskTarget);
      }
    } else {
      tasksWithoutExclude.add(taskTarget);
    }
  }

  const allRunning = new Set<Target>(
    taskIds.map((id) => ({
      project: taskGraph.tasks[id].target.project,
      target: taskGraph.tasks[id].target.target,
    }))
  );
  for (const task of tasksWithoutExclude) {
    const dependencies = getAllDependsOn(nodes, task.project, task.target);
    dependencies.forEach((dep) => allRunning.add(dep));
  }

  const excludeTasks = getExcludeTasks(
    tasksWithExclude,
    nodes,
    allRunning,
    includeDependsOnTasks
  );

  const allTestsDependsOn = new Set<Target>();
  for (const task of testTasksWithExclude) {
    const taskDependsOn = getAllDependsOn(nodes, task.project, task.target);
    taskDependsOn.forEach((dep) => allTestsDependsOn.add(dep));
  }
  const excludeTestTasks = new Set<string>();
  for (const task of allTestsDependsOn) {
    const gradleTaskName = getGradleTaskName(task, nodes);
    if (gradleTaskName) {
      excludeTestTasks.add(gradleTaskName);
    }
  }

  return {
    gradlewTasksToRun,
    excludeTasks,
    excludeTestTasks,
  };
}

async function runTasksInBatch(
  gradlewTasksToRun: Record<string, GradleExecutorSchema>,
  excludeTasks: Set<string>,
  excludeTestTasks: Set<string>,
  args: string[],
  root: string
): Promise<BatchResults> {
  const gradlewBatchStart = performance.mark(`gradlew-batch:start`);

  const debugOptions = (process.env.NX_GRADLE_BATCH_DEBUG ?? '').trim();
  const spawnArgs = [
    ...(debugOptions ? debugOptions.split(/\s+/) : []),
    '-jar',
    batchRunnerPath,
    `--tasks=${JSON.stringify(gradlewTasksToRun)}`,
    `--workspaceRoot=${root}`,
    `--args=${args.join(' ').replaceAll("'", '"')}`,
    `--excludeTasks=${Array.from(excludeTasks).join(',')}`,
    `--excludeTestTasks=${Array.from(excludeTestTasks).join(',')}`,
    ...(process.env.NX_VERBOSE_LOGGING === 'true' ? [] : ['--quiet']),
  ];

  // Use 'inherit' for stderr so Gradle output (tee'd to System.err
  // by TeeOutputStream) flows to the terminal in real-time.
  // stdout is piped to capture the JSON batch results.
  const batchResults = await new Promise<string>((resolve, reject) => {
    const cp = spawn('java', spawnArgs, {
      cwd: workspaceRoot,
      windowsHide: true,
      env: process.env,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    const chunks: Buffer[] = [];
    cp.stdout.on('data', (chunk) => chunks.push(chunk));

    cp.on('error', reject);
    cp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Gradle batch runner exited with code ${code}`));
      } else {
        resolve(Buffer.concat(chunks).toString());
      }
    });
  });

  const gradlewBatchEnd = performance.mark(`gradlew-batch:end`);
  performance.measure(
    `gradlew-batch`,
    gradlewBatchStart.name,
    gradlewBatchEnd.name
  );
  const gradlewBatchResults = JSON.parse(batchResults) as BatchResults;

  return gradlewBatchResults;
}
