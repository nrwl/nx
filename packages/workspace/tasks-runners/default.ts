const REMOVED_MESSAGE =
  '`@nx/workspace/tasks-runners/default` has been removed. ' +
  'Run `nx repair` to drop the obsolete `tasksRunnerOptions` entry from your `nx.json`. Nx will then use its built-in default runner (`nx/tasks-runners/default`) automatically.';

/**
 * @deprecated Removed in favor of Nx's built-in default runner. Invoking this
 * runner throws — run `nx repair` to clean up the legacy reference in
 * `nx.json`.
 */
export default function removedTasksRunner(): never {
  throw new Error(REMOVED_MESSAGE);
}
