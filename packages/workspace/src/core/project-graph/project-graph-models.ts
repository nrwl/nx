import { FileMap } from '../file-graph';
import { FileData } from '../file-utils';
import { NxJson } from '../shared-interfaces';

export interface ProjectGraph {
  nodes: Record<string, ProjectGraphNode>;
  dependencies: Record<string, ProjectGraphDependency[]>;
}

export enum DependencyType {
  static = 'static',
  dynamic = 'dynamic',
  implicit = 'implicit'
}

export interface ProjectGraphNode<T extends {} = {}> {
  type: string;
  name: string;
  data: T & { files: FileData[]; [k: string]: any };
}

export type ProjectGraphNodeRecords = Record<string, ProjectGraphNode>;

export type AddProjectNode = (node: ProjectGraphNode) => void;

export interface ProjectGraphDependency {
  type: DependencyType | string;
  target: string;
  source: string;
}

export type AddProjectDependency = (
  type: DependencyType | string,
  source: string,
  target: string
) => void;

export interface ProjectGraphContext {
  workspaceJson: any;
  nxJson: NxJson;
  fileMap: FileMap;
}

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib'
}
