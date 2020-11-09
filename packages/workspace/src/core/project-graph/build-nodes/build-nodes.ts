import { AddProjectNode, ProjectGraphContext } from '../project-graph-models';
import { FileRead } from '../../file-utils';

export interface BuildNodes {
  (ctx: ProjectGraphContext, addNode: AddProjectNode, fileRead: FileRead): void;
}
