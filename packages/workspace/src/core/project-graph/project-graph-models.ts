import { ProjectFileMap } from '../file-graph';
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

/**
 * @deprecated
 */
export type ProjectGraphNodeRecords = Record<string, ProjectGraphNode>;

/**
 * @deprecated
 */
export type AddProjectNode = (node: ProjectGraphNode) => void;

/**
 * @deprecated
 */
export type AddProjectDependency = (
  type: DependencyType | string,
  source: string,
  target: string
) => void;

/**
 * @deprecated
 */
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
