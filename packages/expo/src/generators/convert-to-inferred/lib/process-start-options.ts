import type { Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { processGenericOptions } from './process-generic-options';

export function processStartOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string,
  migrationLogs: AggregatedLog
) {
  const args: string[] = [];
  if ('dev' in options) {
    if (options.dev === false) args.push('--no-dev');
    delete options.dev;
  }
  options.args = args;
  processGenericOptions(tree, options, projectName, projectRoot, migrationLogs);
}
