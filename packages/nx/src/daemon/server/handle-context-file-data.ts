import { getAllFileDataInContext } from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';
import { HandlerResult } from './server';

export async function handleContextFileData(): Promise<HandlerResult> {
  const files = await getAllFileDataInContext(workspaceRoot);
  return {
    response: JSON.stringify(files),
    description: 'handleContextFileData',
  };
}
