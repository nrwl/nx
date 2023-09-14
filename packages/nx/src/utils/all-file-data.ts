import { FileData } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import { getAllFileDataInContext } from './workspace-context';
import { workspaceRoot } from './workspace-root';

export function allFileData(): Promise<FileData[]> {
  if (daemonClient.enabled()) {
    return daemonClient.getAllFileData();
  } else {
    return Promise.resolve(getAllFileDataInContext(workspaceRoot));
  }
}
