import { Task, Hash, HasherContext } from '@nrwl/devkit';

export default async function run(
  task: Task,
  context: HasherContext
): Promise<Hash> {
  const jestPluginConfig = context.workspaceConfig.pluginsConfig
    ? (context.workspaceConfig.pluginsConfig['@nrwl/jest'] as any)
    : undefined;
  const filter =
    jestPluginConfig && jestPluginConfig.hashingExcludesTestsOfDeps
      ? 'exclude-tests-of-deps'
      : 'all-files';
  return context.hasher.hashTaskWithDepsAndContext(task, filter);
}
