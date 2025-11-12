import { getAllFileDataInContext } from '../../utils/workspace-context.js';
import { workspaceRoot } from '../../utils/workspace-root.js';
import { HandlerResult } from './server.js';

export async function handleContextFileData(): Promise<HandlerResult> {
  const files = await getAllFileDataInContext(workspaceRoot);
  return {
    response: files,
    description: 'handleContextFileData',
  };
}
