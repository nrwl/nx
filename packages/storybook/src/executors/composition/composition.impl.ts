import 'dotenv/config';

import { ExecutorContext, logger } from '@nrwl/devkit';
import type { ProjectConfiguration, Tree } from '@nrwl/devkit';

export interface StorybookCompositionOptions {}

export default async function* storybookExecutor(
  options: StorybookCompositionOptions,
  context: ExecutorContext
) {
  yield { success: true };
  const sourceRoot = context.workspace.projects[context.projectName].root;

  /**
   * Somehow read the main.js file and get the refs object
   *
   * then, from the refs object, get the project names
   */

  const projectNames = [];

  await runInstance(projectNames);
  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

function runInstance(projectNames: string[]) {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;

  /**
   *
   * Write here a command where it runs in parallel all my Storybooks in Storybook composition
   *
   * Also, make sure there are no conflicting ports, if there are throw error
   *
   */
}
