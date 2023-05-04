import {
  Hash,
  ProjectGraph,
  ProjectsConfigurations,
  Task,
  TaskGraph,
  TaskHasher,
  hashArray,
} from '@nx/devkit';

export default async function run(
  task: Task,
  context: {
    hasher: TaskHasher;
    projectGraph: ProjectGraph;
    taskGraph: TaskGraph;
    projectsConfigurations: ProjectsConfigurations;
  }
): Promise<Hash> {
  const res = await context.hasher.hashTask(task);
  if (task.overrides['hasTypeAwareRules'] === true) {
    return res;
  }

  const deps = allDeps(task.id, context.taskGraph, context.projectGraph);
  const tags = hashArray(
    deps.map((d) =>
      (context.projectsConfigurations.projects[d].tags || []).join('|')
    )
  );

  const command = res.details['command'];
  let selfSource = '';
  for (let n of Object.keys(res.details)) {
    if (n.startsWith(`${task.target.project}:`)) {
      selfSource = res.details.nodes[n];
    }
  }

  const nodes = {};
  const hashes = [] as string[];
  for (const d of Object.keys(res.details.nodes)) {
    if (d.indexOf('$fileset') === -1) {
      nodes[d] = res.details.nodes[d];
      hashes.push(res.details.nodes[d]);
    }
  }
  return {
    value: hashArray([command, selfSource, ...hashes, tags]),
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
  if (!taskGraph.tasks) {
    return [];
  }
  const project = taskGraph.tasks[taskId].target.project;
  return projectGraph.dependencies[project]
    .filter((d) => !!projectGraph.nodes[d.target])
    .map((d) => d.target);
}
