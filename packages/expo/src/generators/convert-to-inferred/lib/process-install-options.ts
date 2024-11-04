import type { Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { processGenericOptions } from './process-generic-options';

export function processInstallOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string,
  migrationLogs: AggregatedLog
): void {
  const args: string[] = [];
  // Technically this will not be set in project.json since the value is passed through CLI e.g. nx run <project>:install foo,bar.
  // Handling it here for correctness.
  if ('packages' in options) {
    const v = options.packages;
    const packages = typeof v === 'string' ? v.split(',') : v;
    args.push(...packages);
    delete options.packages;
  }
  options.args = args;
  processGenericOptions(tree, options, projectName, projectRoot, migrationLogs);
}
