import type { ExecutorContext } from '@nx/devkit';
import { runLintTasks } from './run-lint-tasks.js';
import type { LintExecutorSchema } from './schema.js';

/**
 * The non-batched entry (`--batch=false`, `parallelism: false`): the batch core
 * with a single task, so both paths lint and report identically.
 */
export default async function lintExecutor(
  options: LintExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const [result] = Object.values(
    runLintTasks(
      [
        {
          taskId: context.projectName,
          projectName: context.projectName,
          projectRoot:
            context.projectsConfigurations.projects[context.projectName].root,
          options,
        },
      ],
      context.root
    )
  );
  process.stdout.write(result.terminalOutput);
  return { success: result.success };
}
