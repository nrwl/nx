import type { ExecutorContext, TaskGraph } from '@nx/devkit';
import { runLintTasks, type LintTaskResult } from './run-lint-tasks.js';
import type { LintExecutorSchema } from './schema.js';

/**
 * Yields rather than returns: Nx prints and caches a batch task's terminal
 * output as each result streams in, while a result map returned at the end is
 * only recorded.
 */
export default async function* batchLintExecutor(
  taskGraph: TaskGraph,
  inputs: Record<string, LintExecutorSchema>,
  _overrides: LintExecutorSchema,
  context: ExecutorContext
): AsyncGenerator<{ task: string; result: LintTaskResult }> {
  const tasks = Object.values(taskGraph.tasks).map((task) => ({
    taskId: task.id,
    projectName: task.target.project,
    projectRoot:
      task.projectRoot ??
      context.projectsConfigurations.projects[task.target.project].root,
    options: inputs[task.id],
  }));
  const results = runLintTasks(tasks, context.root, context.projectGraph);
  for (const [task, result] of Object.entries(results)) {
    yield { task, result };
  }
}
