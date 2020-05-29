import {
  AddProjectDependency,
  ProjectGraphContext,
  ProjectGraphNodeRecords,
} from '../project-graph-models';

export interface BuildDependencies {
  (
    ctx: ProjectGraphContext,
    nodes: ProjectGraphNodeRecords,
    addDependency: AddProjectDependency,
    fileRead: (s: string) => string
  ): void;
}
