import { getFilesInDirectoryUsingContext } from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';
import { HandlerResult } from './server';

export async function handleGetFilesInDirectory(
  dir: string
): Promise<HandlerResult> {
  const files = await getFilesInDirectoryUsingContext(workspaceRoot, dir);
  return {
    response: JSON.stringify(files),
    description: 'handleNxWorkspaceFiles',
  };
}
