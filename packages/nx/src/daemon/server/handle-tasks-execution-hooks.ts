import type { PreTasksExecutionContext } from '../../project-graph/plugins/public-api';
import type { MaybeStubbedPostTasksExecutionContext } from '../../project-graph/plugins/task-results-stub';
import {
  runPostTasksExecution,
  runPreTasksExecution,
} from '../../project-graph/plugins/tasks-execution-hooks';

export async function handleRunPreTasksExecution(
  context: PreTasksExecutionContext
) {
  try {
    const envs = await runPreTasksExecution(context);
    return {
      response: envs,
      description: 'handleRunPreTasksExecution',
    };
  } catch (e) {
    return {
      error: e,
      description: `Error when running preTasksExecution.`,
    };
  }
}
export async function handleRunPostTasksExecution(
  context: MaybeStubbedPostTasksExecutionContext
) {
  try {
    await runPostTasksExecution(context);
    return {
      response: 'true',
      description: 'handleRunPostTasksExecution',
    };
  } catch (e) {
    return {
      error: e,
      description: `Error when running postTasksExecution.`,
    };
  }
}
