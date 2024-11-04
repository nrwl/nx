import { type Schema } from '../schema';
import {
  type ExecutorContext,
  type ProjectConfiguration,
  runExecutor,
} from '@nx/devkit';

export async function startRemotes(
  remotes: string[],
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: Schema,
  context: ExecutorContext
) {
  const target = 'serve-ssr';
  const remoteIters: AsyncIterable<{ success: boolean }>[] = [];
  for (const app of remotes) {
    if (!workspaceProjects[app].targets?.[target]) {
      throw new Error(`Could not find "${target}" target in "${app}" project.`);
    } else if (!workspaceProjects[app].targets?.[target].executor) {
      throw new Error(
        `Could not find executor for "${target}" target in "${app}" project.`
      );
    }

    const [_, executor] =
      workspaceProjects[app].targets[target].executor.split(':');
    const isUsingModuleFederationSsrDevServerExecutor = executor.includes(
      'module-federation-dev-ssr'
    );

    const configurationOverride = options.devRemotes.find(
      (
        r
      ): r is {
        remoteName: string;
        configuration: string;
      } => typeof r !== 'string' && r.remoteName === app
    )?.configuration;

    remoteIters.push(
      await runExecutor(
        {
          project: app,
          target,
          configuration: configurationOverride ?? context.configurationName,
        },
        {
          ...{ verbose: options.verbose ?? false },
          ...(isUsingModuleFederationSsrDevServerExecutor
            ? { isInitialHost: false }
            : {}),
        },
        context
      )
    );
  }
  return remoteIters;
}
