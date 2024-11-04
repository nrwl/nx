import { names, type TargetConfiguration, type Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

export function processBuildOptions(
  _tree: Tree,
  options: any,
  projectName: string,
  _projectRoot: string,
  target: TargetConfiguration | undefined,
  _migrationLogs: AggregatedLog
): void {
  const args: string[] = [];

  if ('detoxConfiguration' in options) {
    // Need to wrap in --args since --configuration/-c is swallowed by Nx CLI.
    args.push(`--args="-c ${options.detoxConfiguration}"`);
    delete options.detoxConfiguration;
  }

  for (const key of Object.keys(options)) {
    let value = options[key];
    if (typeof value === 'boolean') {
      if (value) args.push(`--${names(key).fileName}`);
    } else {
      args.push(`--${names(key).fileName}`, value);
    }
    delete options[key];
  }

  if (target) {
    target.command = `nx run ${projectName}:build`;
  }

  options.args = args;
}
