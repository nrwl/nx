import { ModuleFederationDevServerOptions } from '../schema';
import { ProjectConfiguration, ExecutorContext, runExecutor } from '@nx/devkit';

export async function startRemotes(
  remotes: string[],
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: Partial<
    Pick<
      ModuleFederationDevServerOptions,
      'devRemotes' | 'host' | 'ssl' | 'sslCert' | 'sslKey' | 'verbose'
    >
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
