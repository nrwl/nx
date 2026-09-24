import { NxJsonConfiguration, TargetDependencies } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
import { affectedTasks as nativeAffectedTasks } from '../../native';
import {
  createTaskGraphWithDependencyOverrides,
  narrowTaskGraph,
} from '../../tasks-runner/create-task-graph';
import { runnableForTarget } from '../../utils/project-graph-utils';
import { FileChange, readPackageJson } from '../file-utils';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createTaskPlanningContext,
  TaskPlanningContext,
} from '../../hasher/task-planning-context';
import { DependencyChanges } from './affected-project-graph-models';
import { daemonClient } from '../../daemon/client/client';
import { isOnDaemon } from '../../daemon/is-on-daemon';
import { getProjectGlobPatterns } from './affected-projects';
import { lockFileDependencyChanges } from '../../plugins/js/project-graph/affected/lock-file-changes';
import { packageJsonDependencyChanges } from '../../plugins/js/project-graph/affected/npm-packages';

/**
 * Whether `nx affected` selects the individual tasks whose inputs a change
 * reaches, rather than whole projects. Off by default while the task path
 * settles.
 *
 * Env-var only, so `nx show projects --affected -t build` and
 * `nx affected -t build` in one CI script agree on what is affected. The run
 * also executes the dependencies those tasks need, so it runs more than the
 * list names.
 */
export function selectsAffectedTasks(): boolean {
  return process.env.NX_LEGACY_AFFECTED === 'false';
}

export interface AffectedTasksResult {
  /** Tasks that are themselves affected — NOT their dependency closure. */
  affectedTaskIds: Set<string>;
  /** `affectedTaskIds` plus everything they depend on: what a run keeps. */
  requiredTaskIds: string[];
  /** The full, unpruned graph the answer was computed over. */
  taskGraph: TaskGraph;
  /**
   * The graph the run executes, narrowed from `taskGraph` so the run need not
   * build its own. Absent when it cannot be derived.
   */
  runTaskGraph?: TaskGraph;
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
  /** Projects whose tasks are dropped from the selection, but not from its dependencies. */
  excludedProjects?: string[];
  packageJson?: any;
}

/**
 * What selection needs from the command, reduced to plain data so the daemon
 * can run it. The lockfile diff reads git, so it is taken here.
 */
export interface AffectedTasksRequest {
  targets: string[];
  changedFiles: string[];
  configuration?: string;
  overrides: Record<string, unknown>;
  extraTargetDependencies: TargetDependencies;
  excludeTaskDependencies: boolean;
  excludedProjects: string[];
  dependencies: DependencyChanges;
}

/**
 * Selects the tasks a change reaches, rather than the projects that own a
 * changed file.
 *
 * With the daemon on, the daemon selects: it hashes the tasks that run, and
 * plans are native memory that cannot cross to it, so selecting anywhere else
 * would plan every task twice.
 */
export async function computeAffectedTasks(
  opts: ComputeAffectedTasksOptions
): Promise<AffectedTasksResult> {
  const request: AffectedTasksRequest = {
    targets: opts.targets,
    changedFiles: opts.touchedFiles.map((f) => f.file),
    configuration: opts.configuration,
    overrides: opts.overrides ?? {},
    extraTargetDependencies: opts.extraTargetDependencies ?? {},
    excludeTaskDependencies: opts.excludeTaskDependencies ?? false,
    excludedProjects: opts.excludedProjects ?? [],
    dependencies: dependencyChanges(
      opts.projectGraph,
      opts.touchedFiles,
      opts.nxJson,
      opts.packageJson
    ),
  };

  if (!isOnDaemon() && daemonClient.enabled()) {
    const selection = await daemonClient.selectAffectedTasks(request);
    return {
      affectedTaskIds: new Set(selection.affectedTaskIds),
      requiredTaskIds: selection.requiredTaskIds,
      taskGraph: selection.taskGraph,
      runTaskGraph: selection.runTaskGraph,
    };
  }

  const planningContext = createTaskPlanningContext(
    opts.projectGraph,
    opts.nxJson
  );
  const selection = await selectAffectedTasks(
    opts.projectGraph,
    opts.nxJson,
    planningContext,
    request
  );
  return {
    affectedTaskIds: selection.affectedTaskIds,
    requiredTaskIds: selection.requiredTaskIds,
    taskGraph: selection.taskGraph,
    runTaskGraph: selection.runTaskGraph,
    // The plans ride along so the hasher narrows them instead of building its
    // own. Every task it will be asked about is in here, since the pruned graph
    // is a subset of the one planned above.
    planningContext: selection.plans
      ? {
          ...planningContext,
          plans: { plans: selection.plans, taskGraph: selection.taskGraph },
        }
      : undefined,
  };
}

/**
 * Plans the targets' full task graph, as `run-many` would build it, and matches
 * the changed paths against every plan. There is no project-grained pass in
 * front of it: that bound rests on declared ownership, and under an I/O
 * snapshot a task's observed reads can name a file no project the reverse walk
 * finds would own, so bounding by it would miss the task.
 *
 * The one implementation for the client and the daemon, so the two cannot
 * select differently.
 */
export async function selectAffectedTasks(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  planningContext: TaskPlanningContext,
  request: AffectedTasksRequest
): Promise<{
  affectedTaskIds: Set<string>;
  requiredTaskIds: string[];
  taskGraph: TaskGraph;
  runTaskGraph?: TaskGraph;
  plans?: NonNullable<TaskPlanningContext['plans']>['plans'];
}> {
  const { targets } = request;
  // Only projects that have one of the targets: with a single target,
  // createTaskGraph tries to create a task for projects that lack it and
  // createTask throws.
  const candidates = [...runnableForTarget(projectGraph.nodes, targets)];
  if (!candidates.length) {
    return {
      affectedTaskIds: new Set(),
      requiredTaskIds: [],
      taskGraph: {
        roots: [],
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
      },
    };
  }

  const { taskGraph, dependencyOverrides } =
    createTaskGraphWithDependencyOverrides(
      projectGraph,
      request.extraTargetDependencies,
      candidates,
      targets,
      request.configuration,
      request.overrides,
      request.excludeTaskDependencies
    );
  const taskIds = Object.keys(taskGraph.tasks);
  const plans = planningContext.planner.getPlansReference(taskIds, taskGraph);

  const namedProjects = new Set(request.dependencies.projects);
  const selection = nativeAffectedTasks(
    planningContext.projectGraphRef,
    plans,
    taskGraph,
    request.changedFiles,
    {
      projectGlobPatterns: await getProjectGlobPatterns(nxJson),
      workspaceRoot,
      seedTaskIds: taskIds.filter((id) =>
        namedProjects.has(taskGraph.tasks[id].target.project)
      ),
      changedExternals: request.dependencies.externals,
      changedExternalTypes: request.dependencies.changedExternalTypes,
      excludedProjects: request.excludedProjects,
      targets,
    }
  );

  // The run builds from the owning projects, so only their requested tasks
  // take the CLI overrides there; every other task is a dependency.
  const owning = new Set(
    selection.affected.map((id) => taskGraph.tasks[id].target.project)
  );
  const initial = selection.built.filter((id) => {
    const { project, target } = taskGraph.tasks[id].target;
    return owning.has(project) && targets.includes(target);
  });

  return {
    affectedTaskIds: new Set(selection.affected),
    requiredTaskIds: selection.required,
    taskGraph,
    runTaskGraph: narrowTaskGraph(
      projectGraph,
      taskGraph,
      dependencyOverrides,
      new Set(initial),
      new Set(selection.built),
      new Set(selection.required)
    ),
    plans,
  };
}

/**
 * A lockfile or package.json change reaches a hash as `External(name)`, a
 * package rather than a path, so the JS locators' diff of it is handed over as
 * package names for the plans to match. Costs nothing when neither file is in
 * the diff.
 */
function dependencyChanges(
  projectGraph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration,
  packageJson: any = readPackageJson()
): DependencyChanges {
  const changes = [
    lockFileDependencyChanges(
      touchedFiles,
      projectGraph.nodes,
      nxJson,
      packageJson,
      projectGraph
    ),
    packageJsonDependencyChanges(touchedFiles, nxJson, projectGraph),
  ];
  return {
    externals: [...new Set(changes.flatMap((c) => c.externals))],
    changedExternalTypes: [
      ...new Set(changes.flatMap((c) => c.changedExternalTypes)),
    ],
    projects: [...new Set(changes.flatMap((c) => c.projects))],
  };
}
