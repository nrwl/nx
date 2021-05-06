import { WorkspaceResults } from '@nrwl/workspace/src/command-line/workspace-results';
import type {
  ImplicitDependencyEntry,
  ImplicitJsonSubsetDependency,
  NxAffectedConfig,
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
} from '@nrwl/devkit';

export interface Environment {
  nxJson: NxJsonConfiguration;
  workspaceJson: any;
  workspaceResults: WorkspaceResults;
}

export {
  NxJsonProjectConfiguration as NxJsonProjectConfig,
  NxJsonConfiguration as NxJson,
  NxAffectedConfig,
  ImplicitDependencyEntry,
  ImplicitJsonSubsetDependency,
};
