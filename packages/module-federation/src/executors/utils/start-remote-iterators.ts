import { StartRemoteFn, type StartRemoteIteratorsOptions } from './models';
import {
  getBuildTargetNameFromMFDevServer,
  getModuleFederationConfig,
  getRemotes,
  normalizeProjectName,
  parseStaticRemotesConfig,
  parseStaticSsrRemotesConfig,
  startRemoteProxies,
  startSsrRemoteProxies,
} from '../../utils';
import { buildStaticRemotes } from './build-static-remotes';
import {
  startSsrStaticRemotesFileServer,
  startStaticRemotesFileServer,
} from './start-static-remotes-file-server';
import {
  type ExecutorContext,
  readProjectsConfigurationFromProjectGraph,
} from '@nx/devkit';

export async function startRemoteIterators(
  options: StartRemoteIteratorsOptions,
  context: ExecutorContext,
  startRemoteFn: StartRemoteFn,
  pathToManifestFile: string | undefined,
  pluginName: 'react' | 'angular' = 'react',
  isServer = false
) {
  const nxBin = require.resolve('nx/bin/nx');
  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(context.projectGraph);
  const project = workspaceProjects[context.projectName];
  const buildTargetName = getBuildTargetNameFromMFDevServer(
    project,
    context.projectGraph
  );
  const moduleFederationConfig = getModuleFederationConfig(
    project.targets?.[buildTargetName]?.options?.tsConfig,
    context.root,
    project.root,
    pluginName
  );

  const remoteNames = options.devRemotes.map((r) =>
    typeof r === 'string' ? r : r.remoteName
  );

  const remotes = getRemotes(
    remoteNames,
    options.skipRemotes,
    moduleFederationConfig,
    {
      projectName: project.name,
      projectGraph: context.projectGraph,
      root: context.root,
    },
    pathToManifestFile
  );

  options.staticRemotesPort ??= remotes.staticRemotePort;

  // Set NX_MF_DEV_REMOTES for the Nx Runtime Library Control Plugin
  process.env.NX_MF_DEV_REMOTES = JSON.stringify([
    ...(
      remotes.devRemotes.map((r) =>
        typeof r === 'string' ? r : r.remoteName
      ) ?? []
    ).map((r) => normalizeProjectName(r)),
    normalizeProjectName(project.name),
  ]);

  const staticRemotesConfig = isServer
    ? parseStaticSsrRemotesConfig(
        [...remotes.staticRemotes, ...remotes.dynamicRemotes],
        context
      )
    : parseStaticRemotesConfig(
        [...remotes.staticRemotes, ...remotes.dynamicRemotes],
        context
      );
  const mappedLocationsOfStaticRemotes = await buildStaticRemotes(
    staticRemotesConfig,
    nxBin,
    context,
    options,
    isServer ? 'server' : 'build'
  );

  const devRemoteIters = await startRemoteFn(
    remotes.devRemotes,
    workspaceProjects,
    options,
    context,
    'serve'
  );

  const staticRemotesIter = isServer
    ? startSsrStaticRemotesFileServer(staticRemotesConfig, context, options)
    : startStaticRemotesFileServer(staticRemotesConfig, context, options);

  isServer
    ? startSsrRemoteProxies(
        staticRemotesConfig,
        mappedLocationsOfStaticRemotes,
        options.ssl
          ? {
              pathToCert: options.sslCert,
              pathToKey: options.sslKey,
            }
          : undefined
      )
    : startRemoteProxies(
        staticRemotesConfig,
        mappedLocationsOfStaticRemotes,
        options.ssl
          ? {
              pathToCert: options.sslCert,
              pathToKey: options.sslKey,
            }
          : undefined
      );

  return {
    remotes,
    devRemoteIters,
    staticRemotesIter,
  };
}
