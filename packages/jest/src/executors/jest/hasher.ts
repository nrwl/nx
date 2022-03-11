import {
  NxJsonConfiguration,
  ProjectGraph,
  Task,
  TaskGraph,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { Hash, Hasher } from '@nrwl/workspace/src/core/hasher/hasher';

export default async function run(
  task: Task,
  context: {
    hasher: Hasher;
    projectGraph: ProjectGraph;
    taskGraph: TaskGraph;
    workspaceConfig: WorkspaceJsonConfiguration & NxJsonConfiguration;
  }
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
