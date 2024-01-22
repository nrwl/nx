import { type Schema } from '../schema';
import {
  type ExecutorContext,
  type ProjectConfiguration,
  runExecutor,
} from '@nx/devkit';

export async function startDevRemotes(
  remotes: {
    remotePorts: any[];
    staticRemotes: string[];
    devRemotes: string[];
  },
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: Schema,
  context: ExecutorContext
) {
  const devRemotesIters: AsyncIterable<{ success: boolean }>[] = [];
  for (const app of remotes.devRemotes) {
    if (!workspaceProjects[app].targets?.['serve']) {
      throw new Error(`Could not find "serve" target in "${app}" project.`);
    } else if (!workspaceProjects[app].targets?.['serve'].executor) {
      throw new Error(
        `Could not find executor for "serve" target in "${app}" project.`
      );
    }

    const [collection, executor] =
      workspaceProjects[app].targets['serve'].executor.split(':');
    const isUsingModuleFederationDevServerExecutor = executor.includes(
      'module-federation-dev-server'
    );

    devRemotesIters.push(
      await runExecutor(
        {
          project: app,
          target: 'serve',
          configuration: context.configurationName,
        },
        {
          verbose: options.verbose ?? false,
          ...(isUsingModuleFederationDevServerExecutor
            ? { isInitialHost: false }
            : {}),
        },
        context
      )
    );
  }
  return devRemotesIters;
}
