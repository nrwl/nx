import { workspaceRoot } from '../../utils/workspace-root';
import { hashWithWorkspaceContext } from '../../utils/workspace-context';
import { HandlerResult } from './server';

export async function handleHashGlob(
  globs: string[],
  exclude?: string[]
): Promise<HandlerResult> {
  const files = await hashWithWorkspaceContext(workspaceRoot, globs, exclude);
  return {
    response: JSON.stringify(files),
    description: 'handleHashGlob',
  };
}
