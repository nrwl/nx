import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import {
  ExternalObject,
  FileData,
  HasherOptions,
  hashArray,
  HashPlanner,
  IoSnapshots,
  ProjectGraph as NativeProjectGraph,
  NxWorkspaceFilesExternals,
  TaskHasher,
  transferProjectGraph,
} from '../native';
import type { IgnoredIndexReader } from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';
import type { TaskPlanningContext } from './task-planning-context';
import { subsetHashPlans } from '../native';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript';
import { getTaskIOService } from '../tasks-runner/task-io-service';
import { readJsonFile } from '../utils/fileutils';
import { ioSnapshotEligibilityOptions } from '../io-snapshots/overrides';
import { PartialHash, TaskHasherImpl } from './task-hasher';

export class NativeTaskHasherImpl implements TaskHasherImpl {
  hasher: TaskHasher;
  planner: HashPlanner;
  private readonly planningContext?: TaskPlanningContext;
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  allWorkspaceFilesRef: ExternalObject<FileData[]>;
  projectFileMapRef: ExternalObject<Record<string, FileData[]>>;
  ignoredIndexRef: ExternalObject<IgnoredIndexReader>;
  options: HasherOptions | undefined;
  /**
   * Plans of the last up-front batch and the task graph they were built for.
   * The tasks that batch deferred hash from them later without planning again.
   */
  private upfrontPlans: {
    fingerprint: string;
    taskIds: Set<string>;
    plans: ReturnType<HashPlanner['getPlansReference']>;
  } | null = null;

  constructor(
    workspaceRoot: string,
    nxJson: NxJsonConfiguration,
    private readonly projectGraph: ProjectGraph,
    externals: NxWorkspaceFilesExternals,
    options: { selectivelyHashTsConfig: boolean },
    planningContext?: TaskPlanningContext
  ) {
    // Reuses the marshal and planner memo when affected already built them for
    // this graph; otherwise this is the only phase that needs them.
    this.projectGraphRef =
      planningContext?.projectGraphRef ??
      transferProjectGraph(transformProjectGraphForRust(projectGraph));

    this.allWorkspaceFilesRef = externals.allWorkspaceFiles;
    this.projectFileMapRef = externals.projectFiles;
    this.ignoredIndexRef = externals.ignoredIndex;

    let tsconfig: { compilerOptions?: import('typescript').CompilerOptions } =
      {};
    let paths = {};
    let rootTsConfigPath = getRootTsConfigPath();
    if (rootTsConfigPath) {
      tsconfig = readJsonFile(getRootTsConfigPath());
      paths = tsconfig.compilerOptions?.paths ?? {};
      if (tsconfig.compilerOptions?.paths) {
        delete tsconfig.compilerOptions.paths;
      }
    }

    this.planner =
      planningContext?.planner ?? new HashPlanner(nxJson, this.projectGraphRef);
    this.planningContext = planningContext;
    this.hasher = new TaskHasher(
      workspaceRoot,
      this.projectGraphRef,
      this.projectFileMapRef,
      this.allWorkspaceFilesRef,
      Buffer.from(JSON.stringify(tsconfig)),
      paths,
      rootTsConfigPath,
      options,
      this.ignoredIndexRef
    );
  }

  async hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd?: string,
    collectInputs?: boolean,
    ioSnapshots?: IoSnapshots
  ): Promise<PartialHash> {
    const hashes = await this.hashTasks(
      [task],
      taskGraph,
      { [task.id]: env },
      cwd,
      collectInputs,
      ioSnapshots
    );
    return hashes[0];
  }

  async hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd?: string,
    collectInputs?: boolean,
    ioSnapshots?: IoSnapshots
  ): Promise<PartialHash[]> {
    const envs = perTaskEnvs as Record<string, Record<string, string>>;
    const shouldCollectInputs =
      collectInputs ?? getTaskIOService().hasTaskInputSubscribers();
    const resolvedCwd = cwd ?? process.cwd();
    const hashes: Record<string, PartialHash> = {};
    let unplanned = tasks.map((t) => t.id);
    if (
      this.upfrontPlans &&
      unplanned.some((id) => this.upfrontPlans.taskIds.has(id)) &&
      this.upfrontPlans.fingerprint ===
        taskGraphFingerprint(taskGraph, ioSnapshots)
    ) {
      Object.assign(
        hashes,
        this.hasher.hashPlansFor(
          this.upfrontPlans.plans,
          unplanned,
          envs,
          resolvedCwd,
          shouldCollectInputs
        )
      );
      unplanned = unplanned.filter((id) => !(id in hashes));
    }
    if (unplanned.length > 0) {
      const plans = this.plansFor(unplanned, taskGraph, ioSnapshots);
      Object.assign(
        hashes,
        this.hasher.hashPlans(plans, envs, resolvedCwd, shouldCollectInputs)
      );
    }
    return tasks.map((t) => hashes[t.id]);
  }

  /**
   * Plans through the native planner. With a snapshot set, the tasks JS resolves as
   * custom-hashed or opted out ride along so the planner's eligibility walk
   * withholds their snapshots.
   */
  private plan(
    taskIds: string[],
    taskGraph: TaskGraph,
    ioSnapshots?: IoSnapshots
  ) {
    if (!ioSnapshots) {
      return this.planner.getPlansReference(taskIds, taskGraph);
    }
    return this.planner.getPlansReference(
      taskIds,
      taskGraph,
      ioSnapshots,
      ioSnapshotEligibilityOptions(this.projectGraph, taskGraph)
    );
  }

  async hashTasksUpfront(
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd?: string,
    collectInputs?: boolean,
    ioSnapshots?: IoSnapshots
  ): Promise<Record<string, PartialHash>> {
    const taskIds = tasks.map((t) => t.id);
    const plans = this.plansFor(taskIds, taskGraph, ioSnapshots);
    this.upfrontPlans = {
      fingerprint: taskGraphFingerprint(taskGraph, ioSnapshots),
      taskIds: new Set(taskIds),
      plans,
    };
    const shouldCollectInputs =
      collectInputs ?? getTaskIOService().hasTaskInputSubscribers();
    return this.hasher.hashPlansUpfront(
      plans,
      perTaskEnvs as Record<string, Record<string, string>>,
      cwd ?? process.cwd(),
      shouldCollectInputs
    );
  }

  /**
   * Affected already planned a superset of these tasks. Narrowing that answer
   * skips a second pass over the same planner, which costs about as much as
   * the first even with the subtree memo warm. Falls back to planning when the
   * plans cannot answer for a task, the signal that they describe some other
   * task graph.
   */
  private plansFor(
    taskIds: string[],
    taskGraph: TaskGraph,
    ioSnapshots?: IoSnapshots
  ): ReturnType<HashPlanner['getPlansReference']> {
    // Affected plans without snapshots, so they cannot answer a run that has them.
    const planned = ioSnapshots ? undefined : this.planningContext?.plans;
    if (planned) {
      const subset = subsetHashPlans(planned, taskIds);
      if (subset) {
        return subset;
      }
    }
    return this.plan(taskIds, taskGraph, ioSnapshots);
  }
}

/**
 * Everything the planner reads from a task graph: each task's target and
 * outputs, and the graph's edges, plus the snapshot set the plans were
 * built against. The project graph and nx.json are fixed for the life of a
 * hasher, so equal fingerprints mean equal plans. A run's
 * results (hash, timings) are left out so hashing one task does not
 * invalidate the plans of the rest.
 */
function taskGraphFingerprint(
  taskGraph: TaskGraph,
  ioSnapshots?: IoSnapshots
): string {
  const parts: string[] = [
    ioSnapshots
      ? `${ioSnapshots.commit}@${ioSnapshots.resolution.fetchedAt}`
      : '',
  ];
  for (const id of Object.keys(taskGraph.tasks).sort()) {
    const task = taskGraph.tasks[id];
    parts.push(
      id,
      task.target.project,
      task.target.target,
      task.target.configuration ?? '',
      (task.outputs ?? []).join(','),
      (taskGraph.dependencies[id] ?? []).join(','),
      (taskGraph.continuousDependencies[id] ?? []).join(',')
    );
  }
  return hashArray(parts);
}
