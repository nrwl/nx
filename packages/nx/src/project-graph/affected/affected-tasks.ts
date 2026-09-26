import { NxJsonConfiguration, TargetDependencies } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { TaskGraph } from '../../config/task-graph';
import {
  affectedTasks as nativeAffectedTasks,
  type FileRevisions,
  type IoSnapshots,
} from '../../native';
import { applyIoSnapshotOutputs } from '../../io-snapshots/outputs';
import { ioSnapshotEligibilityOptions } from '../../io-snapshots/overrides';
import { snapshotsOf, type IoSnapshotOutcome } from '../../io-snapshots/store';
import type { IoSnapshotVersion } from '../../daemon/message-types/io-snapshot-version';
import {
  createTaskGraph,
  createTaskGraphWithDependencyOverrides,
  filterTaskGraphToSelection,
} from '../../tasks-runner/create-task-graph';
import { runnableForTarget } from '../../utils/project-graph-utils';
import {
  getExecutorForTask,
  pruneToSelectedTasks,
} from '../../tasks-runner/utils';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph';
import {
  calculateFileChanges,
  FileChange,
  readPackageJson,
} from '../file-utils';
import type { NxArgs } from '../../utils/command-line-utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { logger } from '../../utils/logger';
import { DaemonProjectGraphError, ProjectGraphError } from '../error-types';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createTaskPlanningContext,
  TaskPlanningContext,
} from '../../hasher/task-planning-context';
import { DependencyChanges } from './affected-project-graph-models';
import type { TaskSelection } from '../../tasks-runner/run-command';
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
 * Env-var only, so `nx show projects --affected` and `nx affected` in one CI
 * script agree. The run also executes the selected tasks' dependencies.
 */
export function selectsAffectedTasks(): boolean {
  return process.env.NX_LEGACY_AFFECTED === 'false';
}

export interface AffectedTasksResult {
  /** The graph selection ran against, which the command should run with too. */
  projectGraph: ProjectGraph;
  /** Tasks that are themselves affected — NOT their dependency closure. */
  affectedTaskIds: Set<string>;
  /** The full, unpruned graph the answer was computed over. */
  taskGraph: TaskGraph;
  /** What the run executes: the affected tasks and what they depend on. */
  taskSelection: TaskSelection;
}

export interface ComputeAffectedTasksOptions {
  /** Fetched when absent. Unused when the daemon selects; it returns its own graph. */
  projectGraph?: ProjectGraph;
  nxJson: NxJsonConfiguration;
  targets: string[];
  touchedFiles: FileChange[];
  /** What `touchedFiles` was computed from, so the daemon reads the same diff. */
  fileChangeArgs?: FileChangeArgs;
  configuration?: string;
  overrides?: Record<string, unknown>;
  extraTargetDependencies?: TargetDependencies;
  excludeTaskDependencies?: boolean;
  /** `--exclude` project patterns. Their tasks leave the selection but still carry a change and run as dependencies. */
  exclude?: string[];
  packageJson?: any;
  /** This command's I/O snapshot set. Selection plans with it, as the run hashes with it. */
  ioSnapshotOutcome?: IoSnapshotOutcome | null;
  selectivelyHashTsConfig?: boolean;
}

export type FileChangeArgs = Pick<NxArgs, 'base' | 'head' | 'files'>;

/**
 * What selection needs from the command, reduced to plain data so the daemon
 * can run it. Anything read against the project graph, like `--exclude` and the
 * lockfile diff, is resolved by whichever process selects.
 */
export interface AffectedTasksRequest {
  targets: string[];
  changedFiles: string[];
  fileChangeArgs?: FileChangeArgs;
  configuration?: string;
  overrides: Record<string, unknown>;
  extraTargetDependencies: TargetDependencies;
  excludeTaskDependencies: boolean;
  exclude: string[];
  ioSnapshots?: IoSnapshotVersion;
  /** The runner's `selectivelyHashTsConfig`, which decides what the tsconfig hash reads. */
  selectivelyHashTsConfig?: boolean;
}

/**
 * Selects the tasks a change reaches, rather than the projects that own a
 * changed file.
 *
 * With the daemon on, the daemon selects: it hashes the run's tasks, so its
 * planner is the one that remembers the plans. It returns the graph it selected
 * against, which the command must run with.
 */
export async function computeAffectedTasks(
  opts: ComputeAffectedTasksOptions
): Promise<AffectedTasksResult> {
  const request: AffectedTasksRequest = {
    targets: opts.targets,
    changedFiles: opts.touchedFiles.map((f) => f.file),
    fileChangeArgs: opts.fileChangeArgs,
    configuration: opts.configuration,
    overrides: opts.overrides ?? {},
    extraTargetDependencies: opts.extraTargetDependencies ?? {},
    excludeTaskDependencies: opts.excludeTaskDependencies ?? false,
    exclude: opts.exclude ?? [],
    selectivelyHashTsConfig: opts.selectivelyHashTsConfig,
  };
  const ioSnapshots = snapshotsOf(opts.ioSnapshotOutcome ?? null);
  if (ioSnapshots) {
    request.ioSnapshots = {
      commit: ioSnapshots.commit,
      fetchedAt: ioSnapshots.resolution.fetchedAt,
    };
  }

  if (!isOnDaemon() && daemonClient.enabled()) {
    try {
      const selection = await daemonClient.selectAffectedTasks(request);
      return {
        ...selection,
        affectedTaskIds: new Set(selection.affectedTaskIds),
        taskSelection: {
          ...selection.taskSelection,
          ioSnapshotOutcome: opts.ioSnapshotOutcome,
        },
      };
    } catch (e) {
      if (e?.name === DaemonProjectGraphError.name) {
        throw ProjectGraphError.fromDaemonProjectGraphError(e);
      }
      // Not rethrown: the graph fetch handles an unreachable daemon, and a
      // selection error recurs in-process below.
      logger.verbose(`Selecting affected tasks in the daemon failed: ${e}`);
    }
  }

  const projectGraph =
    opts.projectGraph ?? (await createProjectGraphAsync({ exitOnError: true }));
  const planningContext = createTaskPlanningContext(projectGraph, opts.nxJson);
  const selection = await selectAffectedTasks(
    projectGraph,
    opts.nxJson,
    planningContext,
    request,
    {
      touchedFiles: opts.touchedFiles,
      packageJson: opts.packageJson,
      ioSnapshots,
    }
  );
  return {
    projectGraph,
    affectedTaskIds: selection.affectedTaskIds,
    taskGraph: selection.taskGraph,
    taskSelection: {
      ...selection.taskSelection,
      // The planner remembers what selection planned, so the run's hashing reuses it.
      planningContext,
      ioSnapshotOutcome: opts.ioSnapshotOutcome,
    },
  };
}

/**
 * Plans the targets' full task graph and matches the changed paths against
 * every plan. No project-level prefilter: under an I/O snapshot a task can read
 * files no affected project owns. Shared by the client and the daemon.
 */
export async function selectAffectedTasks(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  planningContext: TaskPlanningContext,
  request: AffectedTasksRequest,
  {
    touchedFiles = calculateFileChanges(
      request.changedFiles,
      request.fileChangeArgs as NxArgs
    ),
    packageJson,
    ioSnapshots,
  }: {
    touchedFiles?: FileChange[];
    packageJson?: any;
    ioSnapshots?: IoSnapshots;
  } = {}
): Promise<{
  affectedTaskIds: Set<string>;
  taskGraph: TaskGraph;
  taskSelection: TaskSelection;
}> {
  const { targets } = request;
  // Only projects that have one of the targets: with a single target,
  // createTaskGraph tries to create a task for projects that lack it and
  // createTask throws.
  const candidates = [...runnableForTarget(projectGraph.nodes, targets)];
  if (!candidates.length) {
    const empty: TaskGraph = {
      roots: [],
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
    };
    return {
      affectedTaskIds: new Set(),
      taskGraph: empty,
      taskSelection: { taskGraph: empty, initiatingTaskIds: [], taskIds: [] },
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
      // Dependencies carry a change even when they won't run; `keep` drops them.
      false
    );
  const taskIds = Object.keys(taskGraph.tasks);
  // As the run hashes: observed outputs carry output reads, observed inputs match changes.
  if (ioSnapshots) {
    applyIoSnapshotOutputs(projectGraph, taskGraph, ioSnapshots);
  }
  const plans = ioSnapshots
    ? planningContext.planner.getPlansReference(
        taskIds,
        taskGraph,
        ioSnapshots,
        ioSnapshotEligibilityOptions(projectGraph, taskGraph)
      )
    : planningContext.planner.getPlansReference(taskIds, taskGraph);

  const dependencies = dependencyChanges(
    projectGraph,
    touchedFiles,
    nxJson,
    packageJson
  );
  const namedProjects = new Set(dependencies.projects);
  const projects =
    readProjectsConfigurationFromProjectGraph(projectGraph).projects;
  const selection = nativeAffectedTasks(
    planningContext.projectGraphRef,
    plans,
    taskGraph,
    request.changedFiles,
    {
      projectGlobPatterns: await getProjectGlobPatterns(nxJson),
      workspaceRoot,
      alwaysTouchedTaskIds: taskIds.filter(
        (id) =>
          namedProjects.has(taskGraph.tasks[id].target.project) ||
          hasCustomHasher(taskGraph.tasks[id], projects)
      ),
      changedExternals: dependencies.externals,
      changedExternalTypes: dependencies.changedExternalTypes,
      excludedProjects: request.exclude.length
        ? findMatchingProjects(request.exclude, projectGraph.nodes)
        : [],
      targets,
      revisions: fileRevisions(request.fileChangeArgs),
      selectivelyHashTsConfig: request.selectivelyHashTsConfig ?? false,
    }
  );

  // The run builds from the owning projects, so only their requested tasks
  // take the CLI overrides there; every other task is a dependency.
  const owning = new Set(
    selection.affected.map((id) => taskGraph.tasks[id].target.project)
  );
  const initial = new Set(
    taskIds.filter((id) => {
      const { project, target } = taskGraph.tasks[id].target;
      return owning.has(project) && targets.includes(target);
    })
  );
  // Without dependencies the run builds its initial tasks and nothing else.
  const keep = request.excludeTaskDependencies
    ? selection.required.filter((id) => initial.has(id))
    : selection.required;

  return {
    affectedTaskIds: new Set(selection.affected),
    taskGraph,
    taskSelection: {
      // Edges that disagree on a dependency's overrides leave it to a build
      // from the owning projects, which settles them the way the run always has.
      taskGraph:
        filterTaskGraphToSelection(
          projectGraph,
          taskGraph,
          dependencyOverrides,
          initial,
          new Set(keep)
        ) ??
        pruneToSelectedTasks(
          createTaskGraph(
            projectGraph,
            request.extraTargetDependencies,
            [...owning],
            targets,
            request.configuration,
            request.overrides,
            request.excludeTaskDependencies
          ),
          keep
        ),
      initiatingTaskIds: keep.filter((id) => initial.has(id)),
      taskIds: keep,
    },
  };
}

/** Unset for `--files`, which names files without a diff to compare. */
function fileRevisions(
  args: FileChangeArgs | undefined
): FileRevisions | undefined {
  return args?.base && !args.files?.length
    ? { base: args.base, head: args.head }
    : undefined;
}

/**
 * A custom hasher hashes outside the task's plan, so no instruction says what
 * reaches it and the task is always selected. An executor that cannot be
 * resolved cannot run either, so it is left to the plan.
 */
function hasCustomHasher(
  task: TaskGraph['tasks'][string],
  projects: Record<string, ProjectConfiguration>
): boolean {
  try {
    return !!getExecutorForTask(task, projects).hasherFactory;
  } catch {
    return false;
  }
}

/**
 * A lockfile or package.json change reaches a hash as `External(name)`, a
 * package rather than a path, so it is handed to the plans as package names.
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
