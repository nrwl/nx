import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
import { TargetDependencies } from '../../config/nx-json';
import { affectedTasks as nativeAffectedTasks } from '../../native';
import { getInputs } from '../../hasher/task-hasher';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { projectHasTarget } from '../../utils/project-graph-utils';
import { FileChange } from '../file-utils';
import { getSharedPlanner, marshalGraph } from './marshal-graph';
import { filterAffected } from './affected-project-graph';

export interface AffectedTasksResult {
  /** Tasks that are themselves affected — NOT their dependency closure. */
  affectedTaskIds: Set<string>;
  /** The full, unpruned graph the answer was computed over. */
  taskGraph: TaskGraph;
  /** taskId -> changed files that matched. Only when `collectMatches`. */
  matches?: Record<string, string[]>;
}

export interface ComputeAffectedTasksOptions {
  projectGraph: ProjectGraph;
  nxJson: NxJsonConfiguration;
  targets: string[];
  touchedFiles: FileChange[];
  configuration?: string;
  overrides?: Record<string, unknown>;
  extraTargetDependencies?: TargetDependencies;
  excludeTaskDependencies?: boolean;
  packageJson?: any;
  projectDeletionAffectsAllProjects?: boolean;
  collectMatches?: boolean;
}

/**
 * Selects the tasks a change touches, rather than the projects that own a
 * changed file.
 *
 * The locators still run. A file intersection alone under-selects in three ways
 * they cover: `ProjectConfiguration` resolves to no files at all, so a
 * `project.json` edit can be invisible; lockfile and external-dependency changes
 * are not paths; and a blanket trigger like `nx.json` has no fileset to match.
 * Seeding with them keeps this a superset of the project-grained answer.
 */
export async function computeAffectedTasks(
  opts: ComputeAffectedTasksOptions
): Promise<AffectedTasksResult> {
  const {
    projectGraph,
    nxJson,
    targets,
    touchedFiles,
    configuration,
    overrides = {},
    extraTargetDependencies = {},
    excludeTaskDependencies = false,
  } = opts;

  // Bound the work by the project-grained answer first. A task can only be
  // affected if a changed file reaches its plan, and every route there marks
  // the owning project: its own files, a dependency's files inlined by `^`
  // inputs (whose dependents the reverse walk picks up), and `{workspaceRoot}`
  // filesets (which getImplicitlyTouchedProjects attributes). So
  // projects-of(affected tasks) is a subset of the project-grained set, and
  // planning anything outside it is wasted — which for a docs-only change is
  // every task in the workspace.
  const affectedProjects = new Set(
    Object.keys(
      (
        await filterAffected(
          projectGraph,
          touchedFiles,
          nxJson,
          opts.packageJson,
          opts.projectDeletionAffectsAllProjects
        )
      ).nodes
    )
  );

  // Only projects that have one of the targets: with a single target,
  // createTaskGraph tries to create a task for projects that lack it and
  // createTask throws.
  const candidates = Object.values(projectGraph.nodes)
    .filter(
      (node) =>
        affectedProjects.has(node.name) &&
        targets.some((t) => projectHasTarget(node, t))
    )
    .map((node) => node.name);

  if (!candidates.length) {
    return {
      affectedTaskIds: new Set(),
      taskGraph: {
        roots: [],
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
      },
    };
  }

  const taskGraph = createTaskGraph(
    projectGraph,
    extraTargetDependencies,
    candidates,
    targets,
    configuration,
    overrides,
    excludeTaskDependencies
  );
  const taskIds = Object.keys(taskGraph.tasks);

  const graphRef = marshalGraph(projectGraph);
  const plans = getSharedPlanner(projectGraph, nxJson).getPlansReference(
    taskIds,
    taskGraph
  );

  const fileMatches = nativeAffectedTasks(
    graphRef,
    plans,
    touchedFiles.map((f) => f.file),
    opts.collectMatches ?? false
  );

  const own = new Set(fileMatches.affected);

  // Seeds for what a file intersection cannot see: ProjectConfiguration
  // resolves to no files, lockfile and external changes are not paths, and a
  // blanket trigger has no fileset. Those all surface as a touched project.
  for (const taskId of taskIds) {
    if (affectedProjects.has(taskGraph.tasks[taskId].target.project)) {
      own.add(taskId);
    }
  }

  return {
    affectedTaskIds: propagate(own, taskGraph, projectGraph, nxJson),
    taskGraph,
    matches: fileMatches.matches ?? undefined,
  };
}

/**
 * Propagates affectedness along `dependentTasksOutputFiles` edges.
 *
 * A consumer reads its dependency's build artifacts, which are gitignored and do
 * not exist yet, so the dependency's *inputs* are what decide the consumer. Three
 * bits per task carried over a topological order give that in O(V+E), where
 * unioning the upstream file sets would copy a shared ancestor once per path
 * through a diamond.
 */
function propagate(
  own: Set<string>,
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): Set<string> {
  const order = topologicalOrder(taskGraph);
  const affected = new Set(own);
  const reach = new Set<string>();

  for (const taskId of order) {
    const deps = taskGraph.dependencies[taskId] ?? [];
    if (!deps.length) continue;

    let directHit = false;
    let reachHit = false;
    for (const dep of deps) {
      if (affected.has(dep)) directHit = true;
      if (affected.has(dep) || reach.has(dep)) reachHit = true;
    }
    if (reachHit) reach.add(taskId);
    if (affected.has(taskId)) continue;

    const depsOutputs = getDepsOutputs(taskId, taskGraph, projectGraph, nxJson);
    if (!depsOutputs.length) continue;
    const wantsTransitive = depsOutputs.some((d) => d.transitive === true);
    const wantsDirect = depsOutputs.some((d) => d.transitive !== true);

    if ((wantsDirect && directHit) || (wantsTransitive && reachHit)) {
      affected.add(taskId);
      reach.add(taskId);
    }
  }
  return affected;
}

function getDepsOutputs(
  taskId: string,
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): Array<{ transitive?: boolean }> {
  const task = taskGraph.tasks[taskId];
  if (!task || !projectGraph.nodes[task.target.project]) return [];
  try {
    return getInputs(task, projectGraph, nxJson).depsOutputs ?? [];
  } catch {
    // A target whose inputs cannot be expanded cannot be reasoned about; the
    // file intersection already had its say.
    return [];
  }
}

/**
 * Dependencies before dependents. Any task left over by a cycle is appended, so
 * a cyclic graph degrades to "no propagation across the cycle" rather than
 * hanging or dropping tasks.
 */
function topologicalOrder(taskGraph: TaskGraph): string[] {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const ids = Object.keys(taskGraph.tasks);

  for (const id of ids) {
    inDegree.set(id, 0);
  }
  for (const id of ids) {
    for (const dep of taskGraph.dependencies[id] ?? []) {
      if (!inDegree.has(dep)) continue;
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      const list = dependents.get(dep);
      if (list) list.push(id);
      else dependents.set(dep, [id]);
    }
  }

  const queue = ids.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const next = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
  }
  if (order.length < ids.length) {
    const seen = new Set(order);
    order.push(...ids.filter((id) => !seen.has(id)));
  }
  return order;
}
