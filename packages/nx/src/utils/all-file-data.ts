import { FileData } from '../config/project-graph';
import { getAllFileDataInContext } from './workspace-context';
import { workspaceRoot } from './workspace-root';

export function allFileData(): Promise<FileData[]> {
  return getAllFileDataInContext(workspaceRoot);
}
