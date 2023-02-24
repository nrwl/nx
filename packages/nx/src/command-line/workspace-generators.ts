import { NX_PREFIX } from '../utils/logger';
import { output } from '../utils/output';

export async function workspaceGenerators(args: string[]) {
  const bodyLines: string[] = [
    'Instead, Nx now supports executing generators or executors from ',
    'local plugins. To run a generator from a local plugin, ',
    'use `nx generate` like you would with any other generator.',
    '',
    'For more information, see: https://nx.dev/deprecated/workspace-generators',
  ];
  output.error({
    title: `${NX_PREFIX} Workspace Generators are no longer supported`,
    bodyLines,
  });
  // In case users have scripted around workspace-generator, this will ensure commands fail :)
  process.exit(1);
}
