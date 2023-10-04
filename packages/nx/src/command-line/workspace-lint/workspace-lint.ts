import { output } from '../../utils/output';

export async function workspaceLint(): Promise<void> {
  output.warn({
    title: `"nx workspace-lint" has been deprecated.`,
    bodyLines: [
      `Nx has been reworked to make sure that the issues workspace-lint used to catch are no longer possible.`,
      `Remove "nx workspace-lint" from your CI.`,
    ],
  });
}
