import {
  ProjectGraph,
  Task,
  TaskGraph,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { Hash, Hasher } from '@nrwl/workspace/src/core/hasher/hasher';

export default async function run(
  task: Task,
  context: {
    hasher: Hasher;
    projectGraph: ProjectGraph;
    taskGraph: TaskGraph;
    workspaceConfig: WorkspaceJsonConfiguration;
  }
): Promise<Hash> {
  if (task.overrides['hasTypeAwareRules'] === true) {
    return context.hasher.hashTaskWithDepsAndContext(task);
  }

  const command = context.hasher.hashCommand(task);
  const source = await context.hasher.hashSource(task);
  const deps = allDeps(task.id, context.taskGraph, context.projectGraph);
  const tags = context.hasher.hashArray(
    deps.map((d) => (context.workspaceConfig.projects[d].tags || []).join('|'))
  );
  const taskContext = await context.hasher.hashContext();
  return {
    value: context.hasher.hashArray([
      command,
      source,
      tags,
      taskContext.implicitDeps.value,
      taskContext.runtime.value,
    ]),
    details: {
      command,
      nodes: { [task.target.project]: source, tags },
      implicitDeps: taskContext.implicitDeps.files,
      runtime: taskContext.runtime.runtime,
    },
  };
}

function allDeps(
  taskId: string,
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph
): string[] {
  const project = taskGraph.tasks[taskId].target.project;
  const dependencies = projectGraph.dependencies[project]
    .filter((d) => !!projectGraph.nodes[d.target])
    .map((d) => d.target);
  return dependencies;
}
