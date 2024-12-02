import { ModuleFederationSsrDevServerOptions } from '../schema';
import { runExecutor, ExecutorContext, ProjectConfiguration } from '@nx/devkit';

export async function startRemotes(
  remotes: string[],
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: Partial<
    Pick<
      ModuleFederationSsrDevServerOptions,
      'devRemotes' | 'host' | 'ssl' | 'sslCert' | 'sslKey' | 'verbose'
    >
  >,
  context: ExecutorContext
) {
  const remoteIters: AsyncIterable<{ success: boolean }>[] = [];
  const target = 'serve';
  for (const app of remotes) {
    const remoteProjectServeTarget = workspaceProjects[app].targets[target];
    const isUsingModuleFederationSsrDevServerExecutor =
      remoteProjectServeTarget.executor.includes(
        'module-federation-ssr-dev-server'
      );

    const configurationOverride = options.devRemotes?.find(
      (remote): remote is { remoteName: string; configuration: string } =>
        typeof remote !== 'string' && remote.remoteName === app
    )?.configuration;
    {
      const defaultOverrides = {
        ...(options.host ? { host: options.host } : {}),
        ...(options.ssl ? { ssl: options.ssl } : {}),
        ...(options.sslCert ? { sslCert: options.sslCert } : {}),
        ...(options.sslKey ? { sslKey: options.sslKey } : {}),
      };

      const overrides = {
        watch: true,
        ...defaultOverrides,
        ...(isUsingModuleFederationSsrDevServerExecutor
          ? { isInitialHost: false }
          : {}),
      };

      remoteIters.push(
        await runExecutor(
          {
            project: app,
            target,
            configuration: configurationOverride ?? context.configurationName,
          },
          overrides,
          context
        )
      );
    }
  }
  return remoteIters;
}
