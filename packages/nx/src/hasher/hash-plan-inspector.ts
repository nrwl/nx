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
      this.projectGraphRef,
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
    overrides: Object = {},
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
    { project, target, configuration }: Target,
    parsedArgs: { [k: string]: any } = {},
    extraTargetDependencies: Record<
      string,
      (TargetDependencyConfig | string)[]
    > = {},
    excludeTaskDependencies: boolean = false
  ): Record<string, HashInputs> {
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
    const plansReference = this.planner.getPlansReference(taskIds, taskGraph);
    return this.inspector.inspectInputs(plansReference);
  }
}
