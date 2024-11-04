import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

export function processStartOptions(
  _projectName: string,
  options: any,
  _migrationLogs: AggregatedLog
) {
  const args: string[] = [];
  for (const k of Object.keys(options)) {
    if (k === 'resetCache') {
      if (options[k] === true) {
        args.push(`--reset-cache`);
      }
    } else if (k === 'interactive') {
      if (options[k] === false) {
        args.push(`--no-interactive`);
      }
    } else {
      args.push(`--${k}`, options[k]);
    }
    delete options[k];
  }
  options.args = args;
}
