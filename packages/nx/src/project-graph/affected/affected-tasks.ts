import { NxJsonConfiguration, TargetDependencies } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
import { affectedTasks as nativeAffectedTasks } from '../../native';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { runnableForTarget } from '../../utils/project-graph-utils';
import { FileChange, readPackageJson } from '../file-utils';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createTaskPlanningContext,
  TaskPlanningContext,
} from '../../hasher/task-planning-context';
import { DependencyChanges } from './affected-project-graph-models';
import { getProjectGlobPatterns } from './affected-projects';
import { lockFileDependencyChanges } from '../../plugins/js/project-graph/affected/lock-file-changes';
import { packageJsonDependencyChanges } from '../../plugins/js/project-graph/affected/npm-packages';
import {
  fetchIoSnapshotsForRun,
  ioSnapshotOptionsFromNxJson,
} from '../../io-snapshots/fetch';
import { applyIoSnapshotOutputs } from '../../io-snapshots/outputs';
import { customHasherTaskIds } from '../../io-snapshots/overrides';

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
}

/**
 * Selects the tasks a change reaches, rather than the projects that own a
 * changed file.
 *
 * The full task graph for the targets is planned, as `run-many` would build it,
 * and the changed paths are matched against every plan. There is no
 * project-grained pass in front of it: that bound rests on declared ownership,
 * and under an I/O snapshot a task's observed reads can name a file no project
 * the reverse walk finds would own, so bounding by it would miss the task.
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

  // Only projects that have one of the targets: with a single target,
  // createTaskGraph tries to create a task for projects that lack it and
  // createTask throws.
  const candidates = [...runnableForTarget(projectGraph.nodes, targets)];
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

  // Before planning: the bundle is what the run hashes with, so selecting from
  // declared inputs alone would pick tasks the hash never sees. Observed
  // outputs join the declared ones first, so a plan's TaskOutput embeds the
  // same vector the task graph carries.
  const ioSnapshots = await fetchIoSnapshotsForRun(
    nxJson,
    ioSnapshotOptionsFromNxJson(nxJson)
  );
  if (ioSnapshots) {
    applyIoSnapshotOutputs(projectGraph, taskGraph, ioSnapshots);
  }

  const planningContext = createTaskPlanningContext(projectGraph, nxJson);
  const plans = planningContext.planner.getPlansReference(
    taskIds,
    taskGraph,
    ioSnapshots ?? undefined,
    ioSnapshots ? customHasherTaskIds(projectGraph, taskGraph) : undefined
  );

  const dependencies = dependencyChanges(
    projectGraph,
    touchedFiles,
    nxJson,
    opts.packageJson
  );
  const namedProjects = new Set(dependencies.projects);
  const selection = nativeAffectedTasks(
    planningContext.projectGraphRef,
    plans,
    taskGraph,
    touchedFiles.map((f) => f.file),
    {
      projectGlobPatterns: await getProjectGlobPatterns(nxJson),
      workspaceRoot,
      seedTaskIds: taskIds.filter((id) =>
        namedProjects.has(taskGraph.tasks[id].target.project)
      ),
      changedExternals: dependencies.externals,
      allExternalsChanged: dependencies.allExternals,
    }
  );

  return {
    affectedTaskIds: new Set(selection.affected),
    taskGraph,
    // The plans and the bundle they were built with ride along, so the hasher
    // narrows them instead of building its own and the runner does not fetch
    // again. Every task it will be asked about is in here, since the pruned
    // graph is a subset of the one planned above.
    planningContext: { ...planningContext, plans, ioSnapshots },
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
    allExternals: changes.some((c) => c.allExternals),
    projects: [...new Set(changes.flatMap((c) => c.projects))],
  };
}
