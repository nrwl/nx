import { workspaceRoot } from '../../utils/workspace-root';
import { globWithWorkspaceContext } from '../../utils/workspace-context';
import { HandlerResult } from './server';

export async function handleGlob(
  globs: string[],
  exclude?: string[]
): Promise<HandlerResult> {
  const files = await globWithWorkspaceContext(workspaceRoot, globs, exclude);
  return {
    response: JSON.stringify(files),
    description: 'handleGlob',
  };
}
