import {
  parseTargetString,
  readJsonFile,
  stripIndents,
  type ExecutorContext,
} from '@nx/devkit';
import { join } from 'path';
import type { NormalizedExecutorOptions } from '../../../utils/schema';
import { getTaskOptions } from './get-task-options';
import type { TypescriptInMemoryTsConfig } from './typescript-compilation';

export function getProcessedTaskTsConfigs(
  tasks: string[],
  tasksOptions: Record<string, NormalizedExecutorOptions>,
  context: ExecutorContext
): Record<string, TypescriptInMemoryTsConfig> {
  const taskInMemoryTsConfigMap: Record<string, TypescriptInMemoryTsConfig> =
    {};

  for (const task of tasks) {
    generateTaskProjectTsConfig(
      task,
      tasksOptions,
      context,
      taskInMemoryTsConfigMap
    );
  }

  return taskInMemoryTsConfigMap;
}

const projectTsConfigCache = new Map<
  string,
  { tsConfigPath: string; tsConfig: TypescriptInMemoryTsConfig }
>();
function generateTaskProjectTsConfig(
  task: string,
  tasksOptions: Record<string, NormalizedExecutorOptions>,
  context: ExecutorContext,
  taskInMemoryTsConfigMap: Record<string, TypescriptInMemoryTsConfig>
): string {
  const { project } = parseTargetString(task, context);
  if (projectTsConfigCache.has(project)) {
    const { tsConfig, tsConfigPath } = projectTsConfigCache.get(project);
    taskInMemoryTsConfigMap[task] = tsConfig;
    return tsConfigPath;
  }

  const tasksInProject = [
    task,
    ...getDependencyTasksInSameProject(task, context),
  ];
  const taskWithTscExecutor = tasksInProject.find((t) =>
    hasTscExecutor(t, context)
  );

  if (!taskWithTscExecutor) {
    throw new Error(
      stripIndents`The "@nx/js:tsc" batch executor requires all dependencies to use the "@nx/js:tsc" executor.
        None of the following tasks in the "${project}" project use the "@nx/js:tsc" executor:
        ${tasksInProject.map((t) => `- ${t}`).join('\n')}`
    );
  }

  const projectReferences = [];
  for (const task of tasksInProject) {
    for (const depTask of getDependencyTasksInOtherProjects(
      task,
      project,
      context
    )) {
      const tsConfigPath = generateTaskProjectTsConfig(
        depTask,
        tasksOptions,
        context,
        taskInMemoryTsConfigMap
      );
      projectReferences.push(tsConfigPath);
    }
  }

  const taskOptions =
    tasksOptions[taskWithTscExecutor] ??
    getTaskOptions(taskWithTscExecutor, context);
  const tsConfigPath = taskOptions.tsConfig;

  taskInMemoryTsConfigMap[taskWithTscExecutor] = getInMemoryTsConfig(
    tsConfigPath,
    taskOptions,
    projectReferences
  );

  projectTsConfigCache.set(project, {
    tsConfigPath: tsConfigPath,
    tsConfig: taskInMemoryTsConfigMap[taskWithTscExecutor],
  });

  return tsConfigPath;
}

function getDependencyTasksInOtherProjects(
  task: string,
  project: string,
  context: ExecutorContext
): string[] {
  return context.taskGraph.dependencies[task].filter(
    (t) => t !== task && parseTargetString(t, context).project !== project
  );
}

function getDependencyTasksInSameProject(
  task: string,
  context: ExecutorContext
): string[] {
  const { project: taskProject } = parseTargetString(task, context);

  return Object.keys(context.taskGraph.tasks).filter(
    (t) => t !== task && parseTargetString(t, context).project === taskProject
  );
}

function getInMemoryTsConfig(
  tsConfig: string,
  taskOptions: {
    tsConfig: string | null;
    rootDir: string;
    outputPath: string;
  },
  projectReferences: string[]
): TypescriptInMemoryTsConfig {
  const originalTsConfig = readJsonFile(tsConfig, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  const allProjectReferences = Array.from(
    new Set<string>(
      (originalTsConfig.references ?? [])
        .map((r: { path: string }) => r.path)
        .concat(projectReferences)
    )
  );

  return {
    content: JSON.stringify({
      ...originalTsConfig,
      compilerOptions: {
        ...originalTsConfig.compilerOptions,
        rootDir: taskOptions.rootDir,
        outDir: taskOptions.outputPath,
        composite: true,
        declaration: true,
        declarationMap: true,
        tsBuildInfoFile: join(taskOptions.outputPath, 'tsconfig.tsbuildinfo'),
      },
      references: allProjectReferences.map((pr) => ({ path: pr })),
    }),
    path: tsConfig.replace(/\\/g, '/'),
  };
}

function hasTscExecutor(task: string, context: ExecutorContext): boolean {
  const { project, target } = parseTargetString(task, context);

  return (
    context.projectGraph.nodes[project].data.targets[target].executor ===
    '@nx/js:tsc'
  );
}
