import { names, type TargetConfiguration, type Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

export function processTestOptions(
  _tree: Tree,
  options: any,
  projectName: string,
  _projectRoot: string,
  target: TargetConfiguration | undefined,
  migrationLogs: AggregatedLog
): void {
  const args: string[] = [];

  if ('detoxConfiguration' in options) {
    // Need to wrap in --args since --configuration/-c is swallowed by Nx CLI.
    args.push(`--args="-c ${options.detoxConfiguration}"`);
    delete options.detoxConfiguration;
  }

  if ('deviceBootArgs' in options) {
    args.push(`--device-boot-args="${options.deviceBootArgs}"`); // the value must be specified after an equal sign (=) and inside quotes: https://wix.github.io/Detox/docs/cli/test
    delete options.deviceBootArgs;
  }

  if ('appLaunchArgs' in options) {
    args.push(`--app-launch-args="${options.appLaunchArgs}"`); // the value must be specified after an equal sign (=) and inside quotes: https://wix.github.io/Detox/docs/cli/test
    delete options.appLaunchArgs;
  }

  if ('color' in options) {
    // detox only accepts --no-color, not --color
    if (!options.color) args.push('--no-color');
    delete options.color;
  }

  if ('buildTarget' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/expo:test',
      log: 'Unable to migrate `buildTarget` for Detox test. Use "nx run <project>:run-ios" or "nx run <project>:run-android", and pass "--reuse" option when running tests.',
    });
    delete options.buildTarget;
  }

  const deprecatedOptions = [
    'runnerConfig',
    'recordTimeline',
    'workers',
    'deviceLaunchArgs',
  ];
  for (const key of deprecatedOptions) {
    if (!(key in options)) continue;
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/expo:test',
      log: `Option "${key}" is not migrated since it was removed in Detox 20.`,
    });
    delete options[key];
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
    target.command = `nx run ${projectName}:test`;
  }

  options.args = args;
}
