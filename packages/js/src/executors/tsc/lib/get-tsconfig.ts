import {
  ExecutorContext,
  getOutputsForTargetAndConfiguration,
  parseTargetString,
  readJsonFile,
} from '@nx/devkit';
import { fileExists } from 'nx/src/utils/fileutils';
import { join } from 'path';
import {
  DependentBuildableProjectNode,
  computeCompilerOptionsPaths,
} from '../../../utils/buildable-libs-utils';
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
    generateTaskTsConfigOrGetDependentBuildableProjectNode(
      task,
      tasksOptions,
      context,
      taskInMemoryTsConfigMap
    );
  }

  return taskInMemoryTsConfigMap;
}

const taskTsConfigGenerationCache = new Map<
  string,
  { tsConfig: string } | DependentBuildableProjectNode
>();
function generateTaskTsConfigOrGetDependentBuildableProjectNode(
  task: string,
  tasksOptions: Record<string, NormalizedExecutorOptions>,
  context: ExecutorContext,
  taskInMemoryTsConfigMap: Record<string, TypescriptInMemoryTsConfig>
): { tsConfig: string } | DependentBuildableProjectNode {
  if (taskTsConfigGenerationCache.has(task)) {
    return taskTsConfigGenerationCache.get(task);
  }

  let tsConfig =
    tasksOptions[task]?.tsConfig ?? getTaskOptions(task, context).tsConfig;
  let taskWithTsConfig = task;

  if (!tsConfig) {
    // check if other tasks in the task graph from the same project has a tsConfig
    const otherTasksInProject = getDependencyTasksInSameProject(task, context);
    const taskTsConfig = findTaskWithTsConfig(otherTasksInProject, context);

    if (taskTsConfig) {
      if (taskTsConfigGenerationCache.has(taskTsConfig.tsConfig)) {
        return taskTsConfigGenerationCache.get(taskTsConfig.tsConfig);
      }

      tsConfig = taskTsConfig.tsConfig;
      taskWithTsConfig = taskTsConfig.task;
    }
  }

  if (tsConfig) {
    const { projectReferences, dependentBuildableProjectNodes } =
      collectDependenciesFromTask(
        task,
        tasksOptions,
        context,
        taskInMemoryTsConfigMap
      );

    taskInMemoryTsConfigMap[taskWithTsConfig] = getInMemoryTsConfig(
      tsConfig,
      tasksOptions[taskWithTsConfig] ??
        getTaskOptions(taskWithTsConfig, context),
      projectReferences,
      dependentBuildableProjectNodes
    );

    const result = { tsConfig };
    taskTsConfigGenerationCache.set(task, result);

    return result;
  }

  // there's no tsConfig, return a buildable project node so the path mapping
  // is remapped to the output
  const result = taskToDependentBuildableProjectNode(task, context);
  taskTsConfigGenerationCache.set(task, result);

  return result;
}

const projectDependenciesCache = new Map<
  string,
  {
    projectReferences: string[];
    dependentBuildableProjectNodes: DependentBuildableProjectNode[];
  }
>();
function collectDependenciesFromTask(
  task: string,
  tasksOptions: Record<string, NormalizedExecutorOptions>,
  context: ExecutorContext,
  taskInMemoryTsConfigMap: Record<string, TypescriptInMemoryTsConfig>
): {
  projectReferences: string[];
  dependentBuildableProjectNodes: DependentBuildableProjectNode[];
} {
  const { project: taskProject } = parseTargetString(
    task,
    context.projectGraph
  );

  if (projectDependenciesCache.has(taskProject)) {
    return projectDependenciesCache.get(taskProject);
  }

  const dependentBuildableProjectNodes: DependentBuildableProjectNode[] = [];
  const projectReferences = new Set<string>();

  const allProjectTasks = [
    task,
    ...getDependencyTasksInSameProject(task, context),
  ];
  for (const projectTask of allProjectTasks) {
    for (const depTask of context.taskGraph.dependencies[projectTask] ?? []) {
      if (task === depTask) {
        continue;
      }

      const { project: depTaskProject } = parseTargetString(
        depTask,
        context.projectGraph
      );

      if (depTaskProject === taskProject) {
        // recursively collect dependencies for tasks in the same project
        const result = collectDependenciesFromTask(
          depTask,
          tasksOptions,
          context,
          taskInMemoryTsConfigMap
        );

        result.projectReferences.forEach((pr) => {
          projectReferences.add(pr);
        });
        result.dependentBuildableProjectNodes.forEach((node) => {
          dependentBuildableProjectNodes.push(node);
        });
      } else {
        // task is from a different project, get its project reference or buildable node
        const result = generateTaskTsConfigOrGetDependentBuildableProjectNode(
          depTask,
          tasksOptions,
          context,
          taskInMemoryTsConfigMap
        );
        if ('tsConfig' in result) {
          projectReferences.add(result.tsConfig);
        } else {
          dependentBuildableProjectNodes.push(result);
        }
      }
    }
  }

  projectDependenciesCache.set(taskProject, {
    projectReferences: Array.from(projectReferences),
    dependentBuildableProjectNodes,
  });

  return projectDependenciesCache.get(taskProject);
}

function taskToDependentBuildableProjectNode(
  task: string,
  context: ExecutorContext
): DependentBuildableProjectNode {
  const target = context.taskGraph.tasks[task].target;
  const projectGraphNode = context.projectGraph.nodes[target.project];

  const libPackageJsonPath = join(
    context.root,
    projectGraphNode.data.root,
    'package.json'
  );

  return {
    name: fileExists(libPackageJsonPath)
      ? readJsonFile(libPackageJsonPath).name
      : target.project,
    outputs: getOutputsForTargetAndConfiguration(
      { overrides: {}, target },
      projectGraphNode
    ),
    node: projectGraphNode,
  };
}

function getInMemoryTsConfig(
  tsConfig: string,
  taskOptions: {
    tsConfig: string | null;
    rootDir: string;
    outputPath: string;
  },
  projectReferences: string[],
  dependentBuildableProjectNodes: DependentBuildableProjectNode[]
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
        paths: dependentBuildableProjectNodes.length
          ? computeCompilerOptionsPaths(
              tsConfig,
              dependentBuildableProjectNodes
            )
          : originalTsConfig.compilerOptions?.paths,
      },
      references: allProjectReferences.map((pr) => ({ path: pr })),
    }),
    path: tsConfig.replace(/\\/g, '/'),
  };
}

function findTaskWithTsConfig(
  tasks: string[],
  context: ExecutorContext
): { task: string; tsConfig: string } | null {
  for (const task of tasks) {
    const depTaskOptions = getTaskOptions(task, context);
    if (depTaskOptions?.tsConfig) {
      return { task: task, tsConfig: depTaskOptions.tsConfig };
    }
  }

  return null;
}

function getDependencyTasksInSameProject(
  task: string,
  context: ExecutorContext
): string[] {
  const { project: taskProject } = parseTargetString(
    task,
    context.projectGraph
  );

  return Object.keys(context.taskGraph.tasks).filter(
    (t) =>
      t !== task &&
      parseTargetString(t, context.projectGraph).project === taskProject
  );
}
