import type { Target } from '../command-line/run/run';
import {
  NxJsonConfiguration,
  readNxJson,
  TargetDependencies,
} from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import {
  ExternalObject,
  HashInputs,
  HashInstruction,
  HashPlanner,
  HashPlanInspector as NativeHashPlanInspector,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';
import { createProjectRootMappings } from '../project-graph/utils/find-project-for-path';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
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
    excludeTaskDependencies: boolean = false
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

    const plansReference = this.planner.getPlansReference(taskIds, taskGraph);

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
    excludeTaskDependencies: boolean = false
  ): Record<string, HashInputs> {
    const plansReference = this.getPlansReferenceForTask(
      target,
      parsedArgs,
      extraTargetDependencies,
      excludeTaskDependencies
    );
    return this.inspector.inspectInputs(plansReference);
  }

  /**
   * Builds the hash plan for a task (and its dependencies) and returns the
   * opaque reference consumed by the native inspector. Callers that need more
   * than one inspection (e.g. structured inputs AND dependent-output matching)
   * should build the plan once with this and pass the reference to the
   * `*FromPlan` methods, rather than rebuilding it per inspection.
   */
  getPlansReferenceForTask(
    { project, target, configuration }: Target,
    parsedArgs: { [k: string]: any } = {},
    extraTargetDependencies: Record<
      string,
      (TargetDependencyConfig | string)[]
    > = {},
    excludeTaskDependencies: boolean = false
  ): ExternalObject<Record<string, Array<HashInstruction>>> {
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

    const taskGraph = createTaskGraph(
      this.projectGraph,
      extraTargetDependencies,
      [project],
      nxArgs.targets,
      nxArgs.configuration,
      overrides,
      excludeTaskDependencies
    );

    const taskIds = Object.keys(taskGraph.tasks);
    return this.planner.getPlansReference(taskIds, taskGraph);
  }

  /**
   * Structured HashInputs for every task in a previously-built plan.
   */
  inspectInputsFromPlan(
    plansReference: ExternalObject<Record<string, Array<HashInstruction>>>
  ): Record<string, HashInputs> {
    return this.inspector.inspectInputs(plansReference);
  }

  /**
   * Statically determines which of `files` are covered by each task's
   * `dependentTasksOutputFiles` inputs (the file matches the
   * `dependentTasksOutputFiles` glob AND lies within an upstream task's
   * declared outputs). Pure pattern matching — no disk access — so it reports a
   * match even when the upstream tasks have not produced their outputs yet.
   */
  checkDependentTaskOutputFiles(
    plansReference: ExternalObject<Record<string, Array<HashInstruction>>>,
    files: string[]
  ): Record<string, string[]> {
    return this.inspector.checkDependentTaskOutputFiles(plansReference, files);
  }
}
