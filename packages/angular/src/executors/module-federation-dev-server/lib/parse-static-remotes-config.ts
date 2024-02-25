import type { ExecutorContext } from '@nx/devkit';
import { basename, dirname } from 'path';

export type StaticRemoteConfig = {
  basePath: string;
  outputPath: string;
  urlSegment: string;
};

export type StaticRemotesConfig = {
  remotes: string[];
  config: Record<string, StaticRemoteConfig> | undefined;
};

export function parseStaticRemotesConfig(
  staticRemotes: string[] | undefined,
  context: ExecutorContext
): StaticRemotesConfig {
  if (!staticRemotes?.length) {
    return { remotes: [], config: undefined };
  }

  const config: Record<string, StaticRemoteConfig> = {};
  for (const app of staticRemotes) {
    const outputPath =
      context.projectGraph.nodes[app].data.targets['build'].options.outputPath;
    const basePath = dirname(outputPath);
    const urlSegment = basename(outputPath);
    config[app] = { basePath, outputPath, urlSegment };
  }

  return { remotes: staticRemotes, config };
}
