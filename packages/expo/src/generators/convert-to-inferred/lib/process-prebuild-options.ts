import type { Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { processGenericOptions } from './process-generic-options';

export function processPrebuildOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string,
  migrationLogs: AggregatedLog
): void {
  const args: string[] = [];
  if ('install' in options && options.install === false) {
    args.push('--no-install');
    delete options.install;
  }
  options.args = args;
  processGenericOptions(tree, options, projectName, projectRoot, migrationLogs);
}
