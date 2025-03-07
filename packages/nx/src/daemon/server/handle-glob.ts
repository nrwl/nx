import { workspaceRoot } from '../../utils/workspace-root';
import {
  globWithWorkspaceContext,
  multiGlobWithWorkspaceContext,
} from '../../utils/workspace-context';
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

export async function handleMultiGlob(
  globs: string[],
  exclude?: string[]
): Promise<HandlerResult> {
  const files = await multiGlobWithWorkspaceContext(
    workspaceRoot,
    globs,
    exclude
  );
  return {
    response: JSON.stringify(files),
    description: 'handleMultiGlob',
  };
}
