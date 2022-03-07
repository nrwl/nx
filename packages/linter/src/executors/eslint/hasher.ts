import { ProjectGraph, Task, TaskGraph } from '@nrwl/devkit';
import { Hash, Hasher } from '@nrwl/workspace/src/core/hasher/hasher';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';

export default async function run(
  task: Task,
  taskGraph: TaskGraph,
  hasher: Hasher
): Promise<Hash> {
  if (task.overrides['hasTypeAwareRules'] === true) {
    return hasher.hashTaskWithDepsAndContext(task);
  }
  if (!(global as any).projectGraph) {
    try {
      (global as any).projectGraph = readCachedProjectGraph();
    } catch {
      // do nothing, if project graph is unavailable we fallback to using all projects
    }
  }
  const projectGraph = (global as any).projectGraph;
  const command = hasher.hashCommand(task);
  const sources = await hasher.hashSource(task);
  const workspace = new Workspaces(appRootPath).readWorkspaceConfiguration();
  const deps = projectGraph
    ? allDeps(task.id, taskGraph, projectGraph)
    : Object.keys(workspace.projects);
  const tags = hasher.hashArray(
    deps.map((d) => (workspace.projects[d].tags || []).join('|'))
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
