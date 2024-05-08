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
  context: ExecutorContext,
  target: 'serve' | 'serve-static' = 'serve'
) {
  const remoteIters: AsyncIterable<{ success: boolean }>[] = [];
  for (const app of remotes) {
    if (!workspaceProjects[app].targets?.[target]) {
      throw new Error(`Could not find "${target}" target in "${app}" project.`);
    } else if (!workspaceProjects[app].targets?.[target].executor) {
      throw new Error(
        `Could not find executor for "${target}" target in "${app}" project.`
      );
    }

    const [collection, executor] =
      workspaceProjects[app].targets[target].executor.split(':');
    const isUsingModuleFederationDevServerExecutor = executor.includes(
      'module-federation-dev-server'
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
          ...(target === 'serve' ? { verbose: options.verbose ?? false } : {}),
          ...(isUsingModuleFederationDevServerExecutor
            ? { isInitialHost: false }
            : {}),
        },
        context
      )
    );
  }
  return remoteIters;
}
