import { WorkspaceResults } from '../command-line/workspace-results';
import type { NxJsonConfiguration } from '@nrwl/devkit';

export interface Environment {
  nxJson: NxJsonConfiguration;
  workspaceJson: any;
  workspaceResults: WorkspaceResults;
}
