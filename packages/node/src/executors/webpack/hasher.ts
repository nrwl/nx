import { Task, Hash, HasherContext } from '@nrwl/devkit';

export default async function run(
  task: Task,
  context: HasherContext
): Promise<Hash> {
  const nodeWebpackPluginConfig = context.workspaceConfig.pluginsConfig
    ? (context.workspaceConfig.pluginsConfig['@nrwl/node:webpack'] as any)
    : undefined;
  const filter =
    nodeWebpackPluginConfig && nodeWebpackPluginConfig.hashingExcludesTests
      ? 'exclude-tests-of-all'
      : 'all-files';
  return context.hasher.hashTaskWithDepsAndContext(task, filter);
}
