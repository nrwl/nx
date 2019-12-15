import { AddProjectNode, ProjectGraphContext } from '../project-graph-models';

export interface BuildNodes {
  (
    ctx: ProjectGraphContext,
    addNode: AddProjectNode,
    fileRead: (s: string) => string
  ): void;
}
