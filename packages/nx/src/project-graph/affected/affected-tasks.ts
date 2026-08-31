import { NxJsonConfiguration, TargetDependencies } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
import {
  affectedTasks as nativeAffectedTasks,
  TaskInputMatches,
  touchedTaskInputMatches,
} from '../../native';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { runnableForTarget } from '../../utils/project-graph-utils';
import { FileChange, readPackageJson } from '../file-utils';
import type { AffectedReason } from './affected-reasons';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createTaskPlanningContext,
  TaskPlanningContext,
} from '../../hasher/task-planning-context';
import { DependencyChanges } from './affected-project-graph-models';
import { getProjectGlobPatterns } from './affected-projects';
import { lockFileDependencyChanges } from '../../plugins/js/project-graph/affected/lock-file-changes';
import { packageJsonDependencyChanges } from '../../plugins/js/project-graph/affected/npm-packages';
import { AUTO_AFFECTED_LOCK_FILES } from '../../plugins/js/lock-file/lock-file';
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
  /** Every reason that applies, per affected task. Only when `explain`. */
  reasons?: Record<string, AffectedReason[]>;
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
  /** Collect why each task was selected. Costs an extra native pass. */
  explain?: boolean;
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

  const changedPaths = touchedFiles.map((f) => f.file);
  const dependencies = dependencyChanges(
    projectGraph,
    touchedFiles,
    nxJson,
    opts.packageJson
  );
  const namedProjects = new Set(dependencies.projects.map((t) => t.project));
  const selection = nativeAffectedTasks(
    planningContext.projectGraphRef,
    plans,
    taskGraph,
    changedPaths,
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

  // A second native pass, so the selection path stays a membership test.
  const inputMatches = opts.explain
    ? touchedTaskInputMatches(
        planningContext.projectGraphRef,
        plans,
        changedPaths,
        dependencies.externals,
        dependencies.allExternals
      )
    : undefined;

  return {
    affectedTaskIds: new Set(selection.affected),
    taskGraph,
    reasons: opts.explain
      ? taskReasons(
          selection,
          inputMatches ?? {},
          dependencies,
          changedPaths,
          taskGraph
        )
      : undefined,
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
    projects: changes.flatMap((c) => c.projects),
  };
}

/**
 * Why each selected task is in the answer.
 *
 * Assembled after the fact rather than accumulated during selection, so the
 * selection path costs nothing when `--explain` is off. Every reason that
 * applies is listed: a task can match a changed file, hash a package that
 * moved, and read an affected producer, all at once.
 */
function taskReasons(
  selection: {
    affected: string[];
    producersOf: Record<string, string[]>;
    deletedProjectConfigs: string[];
  },
  inputMatches: Record<string, TaskInputMatches>,
  dependencies: DependencyChanges,
  changedPaths: string[],
  taskGraph: TaskGraph
): Record<string, AffectedReason[]> {
  // What a plan hashing every external saw change.
  const dependencyFiles = changedPaths.filter(
    (file) =>
      file === 'package.json' ||
      (AUTO_AFFECTED_LOCK_FILES as readonly string[]).includes(file)
  );
  const named = new Map<string, AffectedReason[]>();
  for (const { project, ...reason } of dependencies.projects) {
    named.set(project, [...(named.get(project) ?? []), reason]);
  }

  const reasons: Record<string, AffectedReason[]> = {};
  for (const taskId of selection.affected) {
    const forTask: AffectedReason[] = [];
    const matches = inputMatches[taskId];

    for (const match of matches?.files ?? []) {
      forTask.push({
        kind: 'input-file',
        file: match.file,
        pattern: match.pattern,
      });
    }
    for (const pkg of matches?.packages ?? []) {
      forTask.push({ kind: 'npm-package', package: pkg });
    }
    if (matches?.allExternals) {
      for (const file of dependencyFiles) {
        forTask.push({ kind: 'external-dependencies', file });
      }
    }

    // Only the affected producers: the walk records the edges it crossed.
    for (const producer of selection.producersOf[taskId] ?? []) {
      forTask.push({ kind: 'dependent-output', producer });
    }

    const project = taskGraph.tasks[taskId]?.target.project;
    for (const reason of (project && named.get(project)) ?? []) {
      forTask.push(reason);
    }

    // A deleted config seeded every task. Only worth saying when nothing
    // narrower applies, or it would repeat on every line.
    if (!forTask.length) {
      for (const file of selection.deletedProjectConfigs) {
        forTask.push({ kind: 'deleted-project-configuration', file });
      }
    }

    reasons[taskId] = forTask;
  }
  return reasons;
}
