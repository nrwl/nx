import { getNxWorkspaceFilesFromContext } from '../../utils/workspace-context.js';
import { workspaceRoot } from '../../utils/workspace-root.js';
import { HandlerResult } from './server.js';

export async function handleNxWorkspaceFiles(
  projectRootMap: Record<string, string>
): Promise<HandlerResult> {
  const files = await getNxWorkspaceFilesFromContext(
    workspaceRoot,
    projectRootMap
  );
  return {
    response: files,
    description: 'handleNxWorkspaceFiles',
  };
}
