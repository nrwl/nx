import {
  HashPlanInspector as NativeHashPlanInspector,
  HashPlanner,
  transferProjectGraph,
} from '../native';
import { readNxJson } from '../config/nx-json';
import { transformProjectGraphForRust } from '../native/transform-objects';
import { ProjectGraph } from '../config/project-graph';
import { retrieveWorkspaceFiles } from '../project-graph/utils/retrieve-workspace-files';
import { workspaceRoot } from '../utils/workspace-root';
import { createProjectRootMappings } from '../project-graph/utils/find-project-for-path';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import type { Target } from '../command-line/run/run';

export class HashPlanInspector {
  private projectGraphRef = transferProjectGraph(
    transformProjectGraphForRust(this.projectGraph)
  );
  private planner = new HashPlanner(this.nxJson, this.projectGraphRef);
  private inspector: NativeHashPlanInspector;

  constructor(
    private readonly nxJson = readNxJson(),
    private projectGraph: ProjectGraph
  ) {}

  async init() {
    const projectRootMap = createProjectRootMappings(this.projectGraph.nodes);
    const map = Object.fromEntries(projectRootMap.entries());
    const { rustReferences } = await retrieveWorkspaceFiles(workspaceRoot, map);
    this.inspector = new NativeHashPlanInspector(
      rustReferences.allWorkspaceFiles,
      this.projectGraphRef,
      rustReferences.projectFiles
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
