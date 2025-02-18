import { ProjectGraph } from '@nx/devkit';
import { StaticRemoteConfig } from '../../utils';
import { basename, dirname } from 'path';

export function parseRemotesConfig(
  remotes: string[] | undefined,
  workspaceRoot: string,
  projectGraph: ProjectGraph
) {
  if (!remotes?.length) {
    return { remotes: [], config: undefined };
  }
  const config: Record<string, StaticRemoteConfig> = {};
  for (const app of remotes) {
    const outputPath =
      projectGraph.nodes[app].data.targets?.['build']?.options.outputPath ??
      `${workspaceRoot ? `${workspaceRoot}/` : ''}${
        projectGraph.nodes[app].data.root
      }/dist`; // this needs replaced with better logic for finding the output path
    const basePath = dirname(outputPath);
    const urlSegment = app;
    const port = projectGraph.nodes[app].data.targets?.['serve']?.options.port;
    config[app] = { basePath, outputPath, urlSegment, port };
  }

  return { remotes, config };
}
