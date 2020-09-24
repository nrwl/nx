import {
  AddProjectDependency,
  ProjectGraphContext,
  ProjectGraphNodeRecords,
} from '../project-graph-models';
import { FileRead } from '../../file-utils';

export interface BuildDependencies {
  (
    ctx: ProjectGraphContext,
    nodes: ProjectGraphNodeRecords,
    addDependency: AddProjectDependency,
    fileRead: FileRead
  ): void;
}
