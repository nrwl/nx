import type { ProjectGraphProjectNode } from '@nrwl/devkit';

export {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  DependencyType,
} from '@nrwl/devkit';

export type ProjectGraphNodeRecords = Record<string, ProjectGraphProjectNode>;

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib',
}
