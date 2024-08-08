import { names } from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

export function processGenericOptions(
  _tree: Tree,
  options: any,
  _projectName: string,
  _projectRoot: string,
  _migrationLogs: AggregatedLog
) {
  const args = options.args ?? [];
  for (const key of Object.keys(options)) {
    if (key === 'args') continue;
    let value = options[key];
    if (typeof value === 'boolean') {
      if (value) args.push(`--${names(key).fileName}`);
    } else {
      args.push(`--${names(key).fileName}=${value}`);
    }
    delete options[key];
  }
  options.args = args;
}
