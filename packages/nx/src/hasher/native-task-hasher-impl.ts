import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import {
  ExternalObject,
  FileData,
  HasherOptions,
  hashArray,
  HashPlanner,
  ProjectGraph as NativeProjectGraph,
  NxWorkspaceFilesExternals,
  TaskHasher,
  subsetHashPlans,
  transferProjectGraph,
} from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';
import type { TaskPlanningContext } from './task-planning-context';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript';
import { getTaskIOService } from '../tasks-runner/task-io-service';
import { readJsonFile } from '../utils/fileutils';
import { PartialHash, TaskHasherImpl } from './task-hasher';

export class NativeTaskHasherImpl implements TaskHasherImpl {
  hasher: TaskHasher;
  planner: HashPlanner;
  private readonly planningContext?: TaskPlanningContext;
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  allWorkspaceFilesRef: ExternalObject<FileData[]>;
  projectFileMapRef: ExternalObject<Record<string, FileData[]>>;
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
    projectGraph: ProjectGraph,
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
      options
    );
  }

  async hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd?: string,
    collectInputs?: boolean
  ): Promise<PartialHash> {
    const hashes = await this.hashTasks(
      [task],
      taskGraph,
      { [task.id]: env },
      cwd,
      collectInputs
    );
    return hashes[0];
  }

  async hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd?: string,
    collectInputs?: boolean
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
      this.upfrontPlans.fingerprint === taskGraphFingerprint(taskGraph)
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
      const plans = this.plansFor(unplanned, taskGraph);
      Object.assign(
        hashes,
        this.hasher.hashPlans(plans, envs, resolvedCwd, shouldCollectInputs)
      );
    }
    return tasks.map((t) => hashes[t.id]);
  }

  async hashTasksUpfront(
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd?: string,
    collectInputs?: boolean
  ): Promise<Record<string, PartialHash>> {
    const taskIds = tasks.map((t) => t.id);
    const plans = this.plansFor(taskIds, taskGraph);
    this.upfrontPlans = {
      fingerprint: taskGraphFingerprint(taskGraph),
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
    taskGraph: TaskGraph
  ): ReturnType<HashPlanner['getPlansReference']> {
    return (
      (this.planningContext?.plans &&
        subsetHashPlans(this.planningContext.plans, taskIds)) ||
      this.planner.getPlansReference(taskIds, taskGraph)
    );
  }
}

/**
 * Plans depend on each task's target, overrides, outputs and root and on the
 * graph's edges. A run's results (hash, timings) are left out so hashing one
 * task does not invalidate the plans of the rest.
 */
function taskGraphFingerprint(taskGraph: TaskGraph): string {
  const parts: string[] = [];
  for (const id of Object.keys(taskGraph.tasks).sort()) {
    const task = taskGraph.tasks[id];
    parts.push(
      id,
      task.target.project,
      task.target.target,
      task.target.configuration ?? '',
      JSON.stringify(task.overrides ?? {}),
      (task.outputs ?? []).join(','),
      task.projectRoot ?? '',
      (taskGraph.dependencies[id] ?? []).join(','),
      (taskGraph.continuousDependencies[id] ?? []).join(',')
    );
  }
  return hashArray(parts);
}
