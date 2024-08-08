import { names } from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

export function processRunOptions(
  _tree: Tree,
  options: any,
  projectName: string,
  _projectRoot: string,
  migrationLogs: AggregatedLog
) {
  const args: string[] = [];

  for (const key of Object.keys(options)) {
    const v = options[key];
    if (key === 'xcodeConfiguration') {
      args.push('--configuration', v);
    } else if (typeof v === 'boolean') {
      // no need to pass in the flag when it is true, pass the --no-<flag> when it is false. e.g. --no-build-cache, --no-bundler
      if (v === false) {
        args.push(`--no-${names(key).fileName}`);
      }
    } else {
      if (key === 'platform') {
        // Platform isn't necessary to pass to the CLI since it is already part of the inferred command. e.g. run:ios, run:android
      } else if (key === 'clean') {
        migrationLogs.addLog({
          project: projectName,
          executorName: '@nx/export:run',
          log: 'Unable to migrate "clean" option. Use `nx run <project>:prebuild --clean` to regenerate native files.',
        });
      } else {
        args.push(`--${names(key).fileName}`, v);
      }
    }
    delete options[key];
  }

  options.args = args;
}
