import { interpolate } from 'nx/src/devkit-internals';
import { joinPathFragments, ProjectGraph } from '@nx/devkit';
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
    const projectRoot = projectGraph.nodes[app].data.root;
    let outputPath = interpolate(
      projectGraph.nodes[app].data.targets?.['build']?.outputs?.[0] ??
        `${workspaceRoot ? `${workspaceRoot}/` : ''}${
          projectGraph.nodes[app].data.root
        }/dist`,
      {
        projectName: projectGraph.nodes[app].data.name,
        projectRoot,
        workspaceRoot,
      }
    );
    if (outputPath.startsWith(projectRoot)) {
      outputPath = joinPathFragments(workspaceRoot, outputPath);
    }

    const basePath = dirname(outputPath);
    const urlSegment = app;
    const port = projectGraph.nodes[app].data.targets?.['serve']?.options.port;
    config[app] = { basePath, outputPath, urlSegment, port };
  }

  return { remotes, config };
}
