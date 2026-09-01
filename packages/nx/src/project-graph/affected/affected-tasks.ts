import { NxJsonConfiguration, TargetDependencies } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
import {
  affectedTasks as nativeAffectedTasks,
  dependentOutputEdges,
} from '../../native';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { projectHasTarget } from '../../utils/project-graph-utils';
import { FileChange } from '../file-utils';
import { AUTO_AFFECTED_LOCK_FILES } from '../../plugins/js/lock-file/lock-file';
import { existsSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createTaskPlanningContext,
  TaskPlanningContext,
} from '../../hasher/task-planning-context';
import { marshalGraph } from './marshal-graph';
import { filterAffected } from './affected-project-graph';
import { getProjectGlobPatterns } from './affected-projects';
import { combineGlobPatterns } from '../../utils/globs';
import { minimatch } from 'minimatch';
import {
  buildDeclaredProjectReferences,
  expandOverDeclaredReferences,
} from './declared-project-references';

export interface AffectedTasksResult {
  /** Tasks that are themselves affected — NOT their dependency closure. */
  affectedTaskIds: Set<string>;
  /** The full, unpruned graph the answer was computed over. */
  taskGraph: TaskGraph;
  /** Hand to the runner so the survivors are not planned a second time. */
  planningContext?: TaskPlanningContext;
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
  const projectGrained = new Set(
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

  // The reverse walk only follows project-graph edges, so it misses the two
  // target-configuration shapes that name a project directly. Expanding here
  // keeps the candidate set a true superset; without it a change to a project
  // referenced only by `inputs[].projects` or a cross-project `dependsOn`
  // silently selects nothing — which is how project-grained affected behaves
  // today.
  const affectedProjects = expandOverDeclaredReferences(
    projectGrained,
    buildDeclaredProjectReferences(projectGraph)
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

  // marshalGraph is keyed on the graph, so this is the marshal filterAffected
  // already paid for.
  const graphRef = marshalGraph(projectGraph);
  const planningContext = createTaskPlanningContext(projectGraph, nxJson);
  const plans = planningContext.planner.getPlansReference(taskIds, taskGraph);

  // ProjectConfiguration resolves to no files, so the matcher is told which of
  // these paths are configuration and resolves that instruction against the
  // project they belong to. Decided here because it needs the plugins'
  // createNodes globs, which are async to resolve.
  const projectConfigChanges = await changedProjectConfigs(
    touchedFiles,
    nxJson
  );
  const own = new Set(
    nativeAffectedTasks(
      graphRef,
      plans,
      touchedFiles.map((f) => f.file),
      projectConfigChanges
    )
  );

  // Tasks that read an upstream task's artifacts. Those are excluded from
  // direct file matching, because they are gitignored and unbuilt and so can
  // never appear in a diff; this is the only thing carrying that signal.
  const producersOf = dependentOutputEdges(plans, taskGraph);

  // Seed only what a file intersection genuinely cannot see. For ordinary
  // source files the matcher is precise, and seeding every task of the owning
  // project there would just reproduce project granularity.
  //
  //   project.json / package.json  ProjectConfiguration hashes the config
  //                                object and resolves to no files at all.
  //   a lockfile                   External and AllExternalDependencies are
  //                                package names, not paths.
  //   a deleted project config     The project it described is gone, so no
  //                                surviving task has a fileset that names it.
  //
  // `nx.json` needs no seed: every plan carries it in the always-on workspace
  // fileset, so the matcher already reaches every task precisely.
  const blindSpotProjects = projectsOwningBlindSpotChanges(
    touchedFiles,
    affectedProjects,
    projectConfigChanges
  );

  if (blindSpotProjects.size) {
    for (const taskId of taskIds) {
      if (blindSpotProjects.has(taskGraph.tasks[taskId].target.project)) {
        own.add(taskId);
      }
    }
  }

  return {
    affectedTaskIds: propagate(own, taskGraph, producersOf),
    taskGraph,
    // The plans ride along so the hasher can narrow them instead of building
    // its own. Every task it will be asked about is in here, since the pruned
    // graph is a subset of the one planned above.
    planningContext: { ...planningContext, plans },
  };
}

/**
 * Propagates affectedness from a producer to the tasks that read its outputs.
 *
 * A consumer reads its dependency's build artifacts, which are gitignored and do
 * not exist yet, so the dependency's *inputs* are what decide the consumer. The
 * edges come from `dependentOutputEdges`, which resolves both an explicit
 * `dependentTasksOutputFiles` input and an `includeIgnored` fileset overlapping a
 * producer's declared outputs. Walking them in topological order propagates a
 * chain in O(V+E), where unioning upstream file sets would copy a shared
 * ancestor once per path through a diamond.
 */
function propagate(
  own: Set<string>,
  taskGraph: TaskGraph,
  producersOf: Record<string, string[]>
): Set<string> {
  const affected = new Set(own);
  for (const taskId of topologicalOrder(taskGraph)) {
    if (affected.has(taskId)) continue;
    if (producersOf[taskId]?.some((producer) => affected.has(producer))) {
      affected.add(taskId);
    }
  }
  return affected;
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

const PROJECT_CONFIG_FILES = new Set(['project.json', 'package.json']);
const LOCK_FILES = new Set<string>(AUTO_AFFECTED_LOCK_FILES);

/**
 * Changed paths that are project configuration.
 *
 * Uses the plugins' createNodes globs rather than two hardcoded basenames, so a
 * `build.gradle` or a `.csproj` counts the way a `project.json` does.
 */
async function changedProjectConfigs(
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration
): Promise<string[]> {
  const globs = await getProjectGlobPatterns(nxJson);
  if (!globs.length) return [];
  const glob = combineGlobPatterns(globs);
  return touchedFiles
    .map((f) => f.file)
    .filter((file) => minimatch(file, glob, { dot: true }));
}

/**
 * Projects whose tasks must be seeded because a changed file is invisible to
 * glob matching.
 *
 * Both cases widen to everything the project-grained pass selected, because
 * neither leaves anything for the matcher to hit: a lockfile change, whose
 * effect is carried by external package names rather than paths, and a deleted
 * project config, whose project is no longer in the graph at all. The deletion
 * check mirrors `projects_from_project_glob_changes`, which decides the same
 * thing by asking whether the file is still on disk.
 *
 * A config that still exists needs no seed. `ProjectConfiguration` is spliced
 * into the plan of its project and of every consumer of it, and the matcher
 * resolves that instruction against these paths directly. Seeding the consumers
 * here instead would select every task they own, which for a widely depended-on
 * project is more tasks than the project-grained answer contains.
 */
function projectsOwningBlindSpotChanges(
  touchedFiles: FileChange[],
  affectedProjects: Set<string>,
  projectConfigChanges: string[]
): Set<string> {
  const configs = new Set(projectConfigChanges);
  for (const { file } of touchedFiles) {
    const name = file.slice(file.lastIndexOf('/') + 1);
    if (LOCK_FILES.has(name)) {
      return affectedProjects;
    }
    if (!configs.has(file)) continue;
    if (!existsSync(join(workspaceRoot, file))) {
      return affectedProjects;
    }
  }
  return new Set();
}
