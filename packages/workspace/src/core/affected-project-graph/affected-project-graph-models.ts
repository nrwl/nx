import { NxJson } from '../shared-interfaces';

export interface AffectedProjectGraphContext {
  workspaceJson: any;
  nxJson: NxJson<string[]>;
  touchedProjects: string[];
}
