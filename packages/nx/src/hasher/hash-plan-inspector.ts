import type { Target } from '../command-line/run/run';
import {
  NxJsonConfiguration,
  readNxJson,
  TargetDependencies,
} from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import {
  ExternalObject,
  HashInputs,
  HashPlanner,
  type EffectiveInputGroup,
  type IoSnapshots,
  HashPlanInspector as NativeHashPlanInspector,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';
import { createProjectRootMappings } from '../project-graph/utils/find-project-for-path';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import {
  customHasherTaskIds,
  loadIoSnapshotsForHead,
} from '../io-snapshots/overrides';
import { isIoSnapshotFetchEnabled } from '../io-snapshots/fetch';
import { getLatestCommitSha } from '../utils/git-utils';
import type { IoSnapshotReport } from '../io-snapshots/report';
import { splitArgsIntoNxArgsAndOverrides } from '../utils/command-line-utils';
import { getNxWorkspaceFilesFromContext } from '../utils/workspace-context';
import { workspaceRoot } from '../utils/workspace-root';

export class HashPlanInspector {
  private readonly projectGraphRef: ExternalObject<NativeProjectGraph>;
  private planner: HashPlanner;
  private inspector: NativeHashPlanInspector;
  private readonly nxJson: NxJsonConfiguration;

  constructor(
    private projectGraph: ProjectGraph,
    private readonly workspaceRootPath: string = workspaceRoot,
    nxJson?: NxJsonConfiguration
  ) {
    this.nxJson = nxJson ?? readNxJson(this.workspaceRootPath);
    this.projectGraphRef = transferProjectGraph(
      transformProjectGraphForRust(this.projectGraph)
    );
    this.planner = new HashPlanner(this.nxJson, this.projectGraphRef);
  }

  async init() {
    const projectRootMap = createProjectRootMappings(this.projectGraph.nodes);
    const map = Object.fromEntries(projectRootMap.entries());
    const { externalReferences } = await getNxWorkspaceFilesFromContext(
      this.workspaceRootPath,
      map,
      false
    );
    this.inspector = new NativeHashPlanInspector(
      externalReferences.allWorkspaceFiles,
      externalReferences.projectFiles,
      this.workspaceRootPath
    );
  }

  /**
   * This is a lower level method which will inspect the hash plan for a set of tasks.
   */
  inspectHashPlan(
    projectNames: string[],
    targets: string[],
    configuration?: string,
    overrides: Record<string, unknown> = {},
    extraTargetDependencies: TargetDependencies = {},
    excludeTaskDependencies: boolean = false,
    ioSnapshots?: IoSnapshots
  ) {
    const taskGraph = createTaskGraph(
      this.projectGraph,
      extraTargetDependencies,
      projectNames,
      targets,
      configuration,
      overrides,
      excludeTaskDependencies
    );
    // Generate task IDs for ALL tasks in the task graph (including dependencies)
    const taskIds = Object.keys(taskGraph.tasks);

    const plansReference = this.planner.getPlansReference(
      taskIds,
      taskGraph,
      ioSnapshots,
      ioSnapshots
        ? customHasherTaskIds(this.projectGraph, taskGraph)
        : undefined
    );

    return this.inspector.inspect(plansReference);
  }

  /**
   * This inspects tasks involved in the execution of a task, including its dependencies by default.
   * @deprecated Prefer inspectTaskInputs
   */
  inspectTask(
    { project, target, configuration }: Target,
    parsedArgs: { [k: string]: any } = {},
    extraTargetDependencies: Record<
      string,
      (TargetDependencyConfig | string)[]
    > = {},
    excludeTaskDependencies: boolean = false
  ) {
    // Mirror the exact flow from run-one.ts
    const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
      {
        ...parsedArgs,
        configuration: configuration,
        targets: [target],
      },
      'run-one',
      { printWarnings: false },
      this.nxJson
    );

    // Create task graph exactly like run-one.ts does via createTaskGraphAndRunValidations
    const taskGraph = createTaskGraph(
      this.projectGraph,
      extraTargetDependencies,
      [project],
      nxArgs.targets,
      nxArgs.configuration,
      overrides,
      excludeTaskDependencies
    );

    // Generate task IDs for ALL tasks in the task graph (including dependencies)
    const taskIds = Object.keys(taskGraph.tasks);

    const plansReference = this.planner.getPlansReference(taskIds, taskGraph);
    return this.inspector.inspect(plansReference);
  }

  /**
   * Like inspectTask() but returns structured HashInputs objects instead of flat strings.
   * Each input is categorized into files, runtime, environment, depOutputs, or external.
   */
  inspectTaskInputs(
    target: Target,
    parsedArgs: { [k: string]: any } = {},
    extraTargetDependencies: Record<
      string,
      (TargetDependencyConfig | string)[]
    > = {},
    excludeTaskDependencies: boolean = false,
    ioSnapshots?: IoSnapshots
  ): Record<string, HashInputs> {
    const taskGraph = this.taskGraphFor(
      target,
      parsedArgs,
      extraTargetDependencies,
      excludeTaskDependencies
    );
    return this.inspectInputsFor(
      taskGraph,
      ioSnapshots,
      ioSnapshots
        ? customHasherTaskIds(this.projectGraph, taskGraph)
        : undefined
    );
  }

  /**
   * Like inspectTaskInputs(), but loads the I/O snapshot bundle for HEAD
   * first so the result matches what hashing uses. Never fetches. `report`
   * is null when no bundle could be resolved; `unavailable` says why.
   */
  inspectTaskInputsWithIoSnapshots(
    target: Target,
    parsedArgs: { [k: string]: any } = {},
    extraTargetDependencies: Record<
      string,
      (TargetDependencyConfig | string)[]
    > = {},
    excludeTaskDependencies: boolean = false
  ): {
    inputs: Record<string, HashInputs>;
    report: IoSnapshotReport | null;
    unavailable?: 'not-connected' | 'no-head';
  } {
    const taskGraph = this.taskGraphFor(
      target,
      parsedArgs,
      extraTargetDependencies,
      excludeTaskDependencies
    );
    const nxJson = this.nxJson ?? {};
    if (!isIoSnapshotFetchEnabled(nxJson)) {
      return {
        inputs: this.inspectInputsFor(taskGraph),
        report: null,
        unavailable: 'not-connected',
      };
    }
    if (!getLatestCommitSha()) {
      return {
        inputs: this.inspectInputsFor(taskGraph),
        report: null,
        unavailable: 'no-head',
      };
    }
    const snapshots = loadIoSnapshotsForHead(nxJson);
    if (!snapshots) {
      return { inputs: this.inspectInputsFor(taskGraph), report: null };
    }
    const customHashers = customHasherTaskIds(this.projectGraph, taskGraph);
    return {
      inputs: this.inspectInputsFor(taskGraph, snapshots, customHashers),
      report: this.planner.ioSnapshotReport(
        taskGraph,
        snapshots,
        customHashers
      ),
    };
  }

  private taskGraphFor(
    { project, target, configuration }: Target,
    parsedArgs: { [k: string]: any },
    extraTargetDependencies: Record<
      string,
      (TargetDependencyConfig | string)[]
    >,
    excludeTaskDependencies: boolean
  ): TaskGraph {
    const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
      {
        ...parsedArgs,
        configuration: configuration,
        targets: [target],
      },
      'run-one',
      { printWarnings: false },
      this.nxJson
    );
    return createTaskGraph(
      this.projectGraph,
      extraTargetDependencies,
      [project],
      nxArgs.targets,
      nxArgs.configuration,
      overrides,
      excludeTaskDependencies
    );
  }

  /**
   * The file-input groups of each task's plan, as globs. When a task hashes
   * from an I/O snapshot these are the observed reads, not the declared
   * filesets, so callers can render what is actually hashed.
   */
  inspectTaskInputGlobs(
    target: Target,
    parsedArgs: { [k: string]: any } = {},
    extraTargetDependencies: Record<
      string,
      (TargetDependencyConfig | string)[]
    > = {},
    excludeTaskDependencies: boolean = false
  ): Record<string, EffectiveInputGroup[]> {
    const taskGraph = this.taskGraphFor(
      target,
      parsedArgs,
      extraTargetDependencies,
      excludeTaskDependencies
    );
    const nxJson = this.nxJson ?? {};
    const snapshots =
      isIoSnapshotFetchEnabled(nxJson) && getLatestCommitSha()
        ? loadIoSnapshotsForHead(nxJson)
        : null;
    const plansReference = this.planner.getPlansReference(
      Object.keys(taskGraph.tasks),
      taskGraph,
      snapshots ?? undefined,
      snapshots ? customHasherTaskIds(this.projectGraph, taskGraph) : undefined
    );
    return this.inspector.inspectInputGlobs(plansReference);
  }

  private inspectInputsFor(
    taskGraph: TaskGraph,
    ioSnapshots?: IoSnapshots,
    customHashers?: string[]
  ): Record<string, HashInputs> {
    const plansReference = this.planner.getPlansReference(
      Object.keys(taskGraph.tasks),
      taskGraph,
      ioSnapshots,
      customHashers
    );
    return this.inspector.inspectInputs(plansReference);
  }
}
