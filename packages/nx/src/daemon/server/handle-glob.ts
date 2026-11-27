import { workspaceRoot } from '../../utils/workspace-root';
import type { PluginGlobs } from '../../native';
import {
  globPluginFilesWithWorkspaceContext,
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

export async function handleGlobPluginFiles(
  plugins: PluginGlobs[]
): Promise<HandlerResult> {
  const files = await globPluginFilesWithWorkspaceContext(
    workspaceRoot,
    plugins
  );
  return {
    response: files,
    description: 'handleGlobPluginFiles',
  };
}
