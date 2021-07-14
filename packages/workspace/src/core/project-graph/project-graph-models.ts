import type { ProjectFileMap } from '../file-graph';
import type {
  ProjectGraphNode,
  DependencyType,
  NxJsonConfiguration,
} from '@nrwl/devkit';
export {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
  DependencyType,
} from '@nrwl/devkit';

export type ProjectGraphNodeRecords = Record<string, ProjectGraphNode>;

export type AddProjectNode = (node: ProjectGraphNode) => void;

export type AddProjectDependency = (
  type: DependencyType | string,
  source: string,
  target: string
) => void;

export interface ProjectGraphContext {
  workspaceJson: any;
  nxJson: NxJsonConfiguration;
  fileMap: ProjectFileMap;
}

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib',
}
