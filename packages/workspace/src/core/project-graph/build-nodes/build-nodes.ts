import {
  AddProjectNode,
  ProjectGraphContext,
  AddProjectNodeNames
} from '../project-graph-models';

export interface BuildNodes {
  (
    ctx: ProjectGraphContext,
    addNode: AddProjectNode,
    addNodeName: AddProjectNodeNames,
    fileRead: (s: string) => string
  ): void;
}
