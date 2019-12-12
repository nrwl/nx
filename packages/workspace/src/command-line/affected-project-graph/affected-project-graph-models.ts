import { NxJson } from '../shared';

export interface AffectedProjectGraphContext {
  workspaceJson: any;
  nxJson: NxJson;
  touchedProjects: string[];
}
