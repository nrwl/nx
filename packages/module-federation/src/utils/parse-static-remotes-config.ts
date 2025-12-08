import { ExecutorContext, joinPathFragments, ProjectGraph } from '@nx/devkit';
import { dirname } from 'path';
import { interpolate } from 'nx/src/tasks-runner/utils';

export type StaticRemoteConfig = {
  basePath: string;
  outputPath: string;
  urlSegment: string;
  port: number;
};
export type StaticRemotesConfig = {
  remotes: string[];
  config: Record<string, StaticRemoteConfig> | undefined;
};

/**
 * Core implementation for parsing static remotes configuration.
 * Used by both regular and SSR remote config parsers.
 */
function parseRemotesConfigCore(
  staticRemotes: string[] | undefined,
  projectGraph: ProjectGraph,
  workspaceRoot: string,
  isServer: boolean
): StaticRemotesConfig {
  if (!staticRemotes?.length) {
    return { remotes: [], config: undefined };
  }

  const config: Record<string, StaticRemoteConfig> = {};
  for (const app of staticRemotes) {
    const projectRoot = projectGraph.nodes[app].data.root;
    let outputPath = interpolate(
      projectGraph.nodes[app].data.targets?.['build']?.options?.outputPath ??
        projectGraph.nodes[app].data.targets?.['build']?.outputs?.[0] ??
        `${workspaceRoot}/${projectGraph.nodes[app].data.root}/dist`,
      {
        projectName: projectGraph.nodes[app].data.name,
        projectRoot,
        workspaceRoot,
      }
    );
    if (outputPath.startsWith(projectRoot)) {
      outputPath = joinPathFragments(workspaceRoot, outputPath);
    }
    // For SSR, use parent directory as outputPath
    if (isServer) {
      outputPath = dirname(outputPath);
    }
    const basePath = ['', '/', '.'].some((p) => dirname(outputPath) === p)
      ? outputPath
      : dirname(outputPath); // dist || dist/checkout -> dist
    const urlSegment = app;
    const port = projectGraph.nodes[app].data.targets['serve'].options.port;
    config[app] = { basePath, outputPath, urlSegment, port };
  }

  return { remotes: staticRemotes, config };
}

export function parseStaticRemotesConfig(
  staticRemotes: string[] | undefined,
  context: ExecutorContext
): StaticRemotesConfig {
  return parseRemotesConfigCore(
    staticRemotes,
    context.projectGraph,
    context.root,
    false
  );
}

export function parseStaticSsrRemotesConfig(
  staticRemotes: string[] | undefined,
  context: ExecutorContext
): StaticRemotesConfig {
  return parseRemotesConfigCore(
    staticRemotes,
    context.projectGraph,
    context.root,
    true
  );
}
