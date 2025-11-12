import { workspaceRoot } from '../../utils/workspace-root.js';
import {
  hashMultiGlobWithWorkspaceContext,
  hashWithWorkspaceContext,
} from '../../utils/workspace-context.js';
import { HandlerResult } from './server.js';

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

export async function handleHashMultiGlob(
  globs: string[][]
): Promise<HandlerResult> {
  const files = await hashMultiGlobWithWorkspaceContext(workspaceRoot, globs);
  return {
    response: JSON.stringify(files),
    description: 'handleHashMultiGlob',
  };
}
