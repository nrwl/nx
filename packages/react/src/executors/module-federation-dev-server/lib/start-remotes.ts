import { ExecutorContext, ProjectConfiguration, runExecutor } from '@nx/devkit';
import { NormalizedModuleFederationDevServerOptions } from '../schema';

export async function startRemotes(
  remotes: string[],
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: Pick<
    NormalizedModuleFederationDevServerOptions,
    'devRemotes' | 'host' | 'ssl' | 'sslCert' | 'sslKey' | 'verbose'
  >,
  context: ExecutorContext,
  target: 'serve' | 'serve-static' = 'serve'
) {
  const remoteIters: AsyncIterable<{ success: boolean }>[] = [];

  for (const app of remotes) {
    const remoteProjectServeTarget = workspaceProjects[app].targets[target];
    const isUsingModuleFederationDevServerExecutor =
      remoteProjectServeTarget.executor.includes(
        'module-federation-dev-server'
      );

    const configurationOverride = options.devRemotes?.find(
      (
        r
      ): r is {
        remoteName: string;
        configuration: string;
      } => typeof r !== 'string' && r.remoteName === app
    )?.configuration;

    const defaultOverrides = {
      ...(options.host ? { host: options.host } : {}),
      ...(options.ssl ? { ssl: options.ssl } : {}),
      ...(options.sslCert ? { sslCert: options.sslCert } : {}),
      ...(options.sslKey ? { sslKey: options.sslKey } : {}),
    };
    const overrides =
      target === 'serve'
        ? {
            watch: true,
            ...(isUsingModuleFederationDevServerExecutor
              ? { isInitialHost: false }
              : {}),
            ...defaultOverrides,
          }
        : { ...defaultOverrides };

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
  return remoteIters;
}
