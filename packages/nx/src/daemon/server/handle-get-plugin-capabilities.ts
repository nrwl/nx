import { readNxJson } from '../../config/nx-json';
import { getPlugins } from '../../project-graph/plugins/get-plugins';
import { capabilitiesOfLoadedPlugin } from '../../project-graph/plugins/graph-plugin-capabilities';
import { workspaceRoot } from '../../utils/workspace-root';
import type { HandlerResult } from './server';

export async function handleGetPluginCapabilities(): Promise<HandlerResult> {
  const plugins = await getPlugins(readNxJson(workspaceRoot), workspaceRoot);

  return {
    response: plugins.map(capabilitiesOfLoadedPlugin),
    description: 'handleGetPluginCapabilities',
  };
}
