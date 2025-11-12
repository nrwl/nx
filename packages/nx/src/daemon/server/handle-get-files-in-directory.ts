import { getFilesInDirectoryUsingContext } from '../../utils/workspace-context.js';
import { workspaceRoot } from '../../utils/workspace-root.js';
import { HandlerResult } from './server.js';

export async function handleGetFilesInDirectory(
  dir: string
): Promise<HandlerResult> {
  const files = await getFilesInDirectoryUsingContext(workspaceRoot, dir);
  return {
    response: files,
    description: 'handleNxWorkspaceFiles',
  };
}
