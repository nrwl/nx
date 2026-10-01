import type { ExecutorContext, TaskGraph } from '@nx/devkit';
import { runLintTasks, type LintTaskResult } from './run-lint-tasks.js';
import type { LintExecutorSchema } from './schema.js';

/**
 * Yields rather than returns, so Nx prints each task's output as its result
 * streams in, unless it holds batch output for a log group.
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
  const results = runLintTasks(tasks, context.root);
  for (const [task, result] of Object.entries(results)) {
    yield { task, result };
  }
}
