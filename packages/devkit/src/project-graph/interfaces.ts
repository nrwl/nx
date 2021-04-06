import { TargetConfiguration, Workspace } from '@nrwl/tao/src/shared/workspace';

export interface FileData {
  file: string;
  hash: string;
  ext: string;
}

export interface ProjectFileMap {
  [projectName: string]: FileData[];
}

export interface ProjectGraph {
  nodes: Record<string, ProjectGraphNode>;
  dependencies: Record<string, ProjectGraphDependency[]>;

  // this is optional otherwise it might break folks who use project graph creation
  allWorkspaceFiles?: FileData[];
}

export enum DependencyType {
  static = 'static',
  dynamic = 'dynamic',
  implicit = 'implicit',
}

export interface ProjectGraphNode<T = any> {
  type: string;
  name: string;
  data: T & {
    root?: string;
    targets?: { [targetName: string]: TargetConfiguration };
    files: FileData[];
  };
}

export interface ProjectGraphDependency {
  type: DependencyType | string;
  target: string;
  source: string;
}

export interface ProjectGraphProcessorContext {
  workspace: Workspace;
  fileMap: ProjectFileMap;
}

export type ProjectGraphProcessor = (
  currentGraph: ProjectGraph,
  context: ProjectGraphProcessorContext
) => ProjectGraph;

export interface NxPlugin {
  processProjectGraph: ProjectGraphProcessor;
}
