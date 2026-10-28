import { readNxJson } from '../../config/nx-json';
import { getPlugins } from '../../project-graph/plugins/get-plugins';
import { workspaceRoot } from '../../utils/workspace-root';
import type { HandlerResult } from './server';

export async function handleGetPluginCapabilities(): Promise<HandlerResult> {
  const plugins = await getPlugins(readNxJson(workspaceRoot), workspaceRoot);

  return {
    response: plugins.map((plugin) => plugin.capabilities()),
    description: 'handleGetPluginCapabilities',
  };
}
