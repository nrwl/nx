import { Task, TaskGraph } from '@nrwl/devkit';
import { Hash, Hasher } from '@nrwl/workspace/src/core/hasher/hasher';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';

export default async function run(
  task: Task,
  taskGraph: TaskGraph,
  hasher: Hasher
): Promise<Hash> {
  if (task.overrides['hasTypeAwareRules'] === true) {
    return hasher.hashTaskWithDepsAndContext(task);
  }
  const command = hasher.hashCommand(task);
  const sources = await hasher.hashSource(task);
  // TODO: This will be used once we pass hasher's projectGraph
  // const deps = allDeps(task.id, taskGraph);
  const workspace = new Workspaces(appRootPath).readWorkspaceConfiguration();
  const tags = hasher.hashArray(
    // deps.map((d) => (workspace.projects[d].tags || []).join('|'))
    Object.values(workspace.projects).map((proj) => (proj.tags || []).join('|'))
  );
  const context = await hasher.hashContext();
  return {
    value: hasher.hashArray([
      command,
      sources,
      tags,
      context.implicitDeps.value,
      context.runtime.value,
    ]),
    details: {
      command,
      nodes: { [task.target.project]: sources, tags },
      implicitDeps: context.implicitDeps.files,
      runtime: context.runtime.runtime,
    },
  };
}

function allDeps(taskId: string, taskGraph: TaskGraph): string[] {
  return [
    ...taskGraph.dependencies[taskId].map(
      (task) => taskGraph.tasks[task].target.project
    ),
    ...taskGraph.dependencies[taskId].flatMap((task) =>
      allDeps(task, taskGraph)
    ),
  ];
}
