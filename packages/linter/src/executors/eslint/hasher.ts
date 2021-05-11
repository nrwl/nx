import { Task } from '@nrwl/workspace/src/tasks-runner/tasks-runner';
import { TaskGraph } from '@nrwl/workspace/src/tasks-runner/task-graph-creator';
import { Hash, Hasher } from '@nrwl/workspace/src/core/hasher/hasher';
import { readJsonFile } from '@nrwl/workspace/src/utilities/fileutils';

export default async function run(
  task: Task,
  taskGraph: TaskGraph,
  hasher: Hasher
): Promise<Hash> {
  return hasher.hashTaskWithDepsAndContext(task);
  // if (task.overrides['hasTypeAwareRules'] === true) {
  //   return hasher.hashTaskWithDepsAndContext(task);
  // }
  // const sources = await hasher.hashSource(task);
  // const deps = allDeps(task.id, taskGraph);
  // const nxJson = readJsonFile('nx.json');
  // const tags = deps
  //   .map((d) => (nxJson.projects[d].tags || []).join('|'))
  //   .join('|');
  // const context = await hasher.hashContext();
  // return {
  //   value: hasher.hashArray([
  //     sources,
  //     tags,
  //     context.implicitDeps.value,
  //     context.runtime.value,
  //   ]),
  //   details: {
  //     command: null,
  //     runtime: context.runtime.runtime,
  //     implicitDeps: context.implicitDeps.sources,
  //     sources: { [task.target.project]: sources },
  //   },
  // };
}

function allDeps(taskId: string, taskGraph: TaskGraph) {
  return [...taskGraph.dependencies[taskId].map((d) => allDeps(d, taskGraph))];
}
