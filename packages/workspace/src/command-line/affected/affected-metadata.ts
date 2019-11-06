import { DependencyGraph } from '../shared-models';

export interface AffectedMetadata {
  dependencyGraph: DependencyGraph;
  projectStates: Record<string, ProjectState>;
}

export interface ProjectState {
  affected: boolean;
  touched: boolean;
}
