import { ExecutorContext, joinPathFragments } from '@nx/devkit';
import { basename, dirname } from 'path';
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

export function parseStaticRemotesConfig(
  staticRemotes: string[] | undefined,
  context: ExecutorContext
): StaticRemotesConfig {
  if (!staticRemotes?.length) {
    return { remotes: [], config: undefined };
  }

  const config: Record<string, StaticRemoteConfig> = {};
  for (const app of staticRemotes) {
    const projectGraph = context.projectGraph;
    const projectRoot = projectGraph.nodes[app].data.root;
    let outputPath = interpolate(
      projectGraph.nodes[app].data.targets?.['build']?.options?.outputPath ??
        projectGraph.nodes[app].data.targets?.['build']?.outputs?.[0] ??
        `${context.root}/${projectGraph.nodes[app].data.root}/dist`,
      {
        projectName: projectGraph.nodes[app].data.name,
        projectRoot,
        workspaceRoot: context.root,
      }
    );
    if (outputPath.startsWith(projectRoot)) {
      outputPath = joinPathFragments(context.root, outputPath);
    }
    const basePath = ['', '/', '.'].some((p) => dirname(outputPath) === p)
      ? outputPath
      : dirname(outputPath); // dist || dist/checkout -> dist
    const urlSegment = app;
    const port =
      context.projectGraph.nodes[app].data.targets['serve'].options.port;
    config[app] = { basePath, outputPath, urlSegment, port };
  }

  return { remotes: staticRemotes, config };
}

export function parseStaticSsrRemotesConfig(
  staticRemotes: string[] | undefined,
  context: ExecutorContext
): StaticRemotesConfig {
  if (!staticRemotes?.length) {
    return { remotes: [], config: undefined };
  }
  const config: Record<string, StaticRemoteConfig> = {};
  for (const app of staticRemotes) {
    const projectGraph = context.projectGraph;
    const projectRoot = projectGraph.nodes[app].data.root;
    let outputPath = interpolate(
      projectGraph.nodes[app].data.targets?.['build']?.options?.outputPath ??
        projectGraph.nodes[app].data.targets?.['build']?.outputs?.[0] ??
        `${context.root}/${projectGraph.nodes[app].data.root}/dist`,
      {
        projectName: projectGraph.nodes[app].data.name,
        projectRoot,
        workspaceRoot: context.root,
      }
    );
    if (outputPath.startsWith(projectRoot)) {
      outputPath = joinPathFragments(context.root, outputPath);
    }
    outputPath = dirname(outputPath);
    const basePath = ['', '/', '.'].some((p) => dirname(outputPath) === p)
      ? outputPath
      : dirname(outputPath); // dist || dist/checkout -> dist
    const urlSegment = app;
    const port =
      context.projectGraph.nodes[app].data.targets['serve'].options.port;
    config[app] = { basePath, outputPath, urlSegment, port };
  }

  return { remotes: staticRemotes, config };
}
