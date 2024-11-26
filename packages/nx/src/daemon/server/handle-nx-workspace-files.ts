import { getNxWorkspaceFilesFromContext } from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';
import { HandlerResult } from './server';

export async function handleNxWorkspaceFiles(
  projectRootMap: Record<string, string>
): Promise<HandlerResult> {
  const files = await getNxWorkspaceFilesFromContext(
    workspaceRoot,
    projectRootMap
  );
  return {
    response: JSON.stringify(files),
    description: 'handleNxWorkspaceFiles',
  };
}
