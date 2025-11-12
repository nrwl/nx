import { workspaceRoot } from '../../utils/workspace-root.js';
import {
  globWithWorkspaceContext,
  multiGlobWithWorkspaceContext,
} from '../../utils/workspace-context.js';
import { HandlerResult } from './server.js';

export async function handleGlob(
  globs: string[],
  exclude?: string[]
): Promise<HandlerResult> {
  const files = await globWithWorkspaceContext(workspaceRoot, globs, exclude);
  return {
    response: files,
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
    response: files,
    description: 'handleMultiGlob',
  };
}
