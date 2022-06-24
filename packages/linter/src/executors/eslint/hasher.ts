import {
  ProjectGraph,
  Task,
  TaskGraph,
  ProjectsConfigurations,
  Hasher,
  Hash,
} from '@nrwl/devkit';

export default async function run(
  task: Task,
  context: {
    hasher: Hasher;
    projectGraph: ProjectGraph;
    taskGraph: TaskGraph;
    workspaceConfig: ProjectsConfigurations;
  }
): Promise<Hash> {
  const res = await context.hasher.hashTask(task);
  if (task.overrides['hasTypeAwareRules'] === true) {
    return res;
  }

  const deps = allDeps(task.id, context.taskGraph, context.projectGraph);
  const tags = context.hasher.hashArray(
    deps.map((d) => (context.workspaceConfig.projects[d].tags || []).join('|'))
  );

  const command = res.details['command'];
  const selfSource = res.details.nodes[`${task.target.project}:$filesets`];

  const nodes = {};
  const hashes = [] as string[];
  for (const d of Object.keys(res.details.nodes)) {
    if (d.indexOf('$fileset') === -1) {
      nodes[d] = res.details.nodes[d];
      hashes.push(res.details.nodes[d]);
    }
  }
  return {
    value: context.hasher.hashArray([command, selfSource, ...hashes, tags]),
    details: {
      command,
      nodes: { [task.target.project]: selfSource, tags, ...nodes },
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
