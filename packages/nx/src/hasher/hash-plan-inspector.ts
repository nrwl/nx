import {
  HashPlanInspector as NativeHashPlanInspector,
  HashPlanner,
  transferProjectGraph,
  ExternalObject,
  ProjectGraph as NativeProjectGraph,
} from '../native';
import { readNxJson } from '../config/nx-json';
import { transformProjectGraphForRust } from '../native/transform-objects';
import { ProjectGraph } from '../config/project-graph';
import { workspaceRoot } from '../utils/workspace-root';
import { createProjectRootMappings } from '../project-graph/utils/find-project-for-path';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import type { Target } from '../command-line/run/run';
import { getNxWorkspaceFilesFromContext } from '../utils/workspace-context';

export class HashPlanInspector {
  private readonly projectGraphRef: ExternalObject<NativeProjectGraph>;
  private planner: HashPlanner;
  private inspector: NativeHashPlanInspector;

  constructor(
    private readonly nxJson = readNxJson(),
    private projectGraph: ProjectGraph
  ) {
    this.projectGraphRef = transferProjectGraph(
      transformProjectGraphForRust(this.projectGraph)
    );
    this.planner = new HashPlanner(this.nxJson, this.projectGraphRef);
  }

  async init() {
    const projectRootMap = createProjectRootMappings(this.projectGraph.nodes);
    const map = Object.fromEntries(projectRootMap.entries());
    const { externalReferences } = await getNxWorkspaceFilesFromContext(
      workspaceRoot,
      map,
      false
    );
    this.inspector = new NativeHashPlanInspector(
      externalReferences.allWorkspaceFiles,
      this.projectGraphRef,
      externalReferences.projectFiles
    );
  }

  inspectHashPlan({ project, target, configuration }: Target) {
    const taskGraph = createTaskGraph(
      this.projectGraph,
      {},
      [project],
      [target],
      undefined,
      {}
    );
    const plansReference = this.planner.getPlansReference(
      [
        `${project}:${target.indexOf(':') > -1 ? `"${target}"` : target}${
          configuration !== undefined ? ':' + configuration : ''
        }`,
      ],
      taskGraph
    );

    return this.inspector.inspect(plansReference);
  }
}
