import { FileData } from '../config/project-graph.js';
import { getAllFileDataInContext } from './workspace-context.js';
import { workspaceRoot } from './workspace-root.js';

export function allFileData(): Promise<FileData[]> {
  return getAllFileDataInContext(workspaceRoot);
}
