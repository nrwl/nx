import type { DependencyType, ProjectGraphNode } from '@nrwl/devkit';

export {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
  DependencyType,
} from '@nrwl/devkit';

export type ProjectGraphNodeRecords = Record<string, ProjectGraphNode>;

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib',
}
