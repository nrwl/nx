import type { Tree } from '@nx/devkit';
import { joinPathFragments, offsetFromRoot } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { processGenericOptions } from './process-generic-options';

export function processExportOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string,
  migrationLogs: AggregatedLog
) {
  const args: string[] = [];
  if ('minify' in options) {
    if (options.minify === false) args.push('--no-minify');
    delete options.minify;
  }
  if ('bytecode' in options) {
    if (options.bytecode === false) args.push('--no-bytecode');
    delete options.bytecode;
  }
  if ('outputDir' in options) {
    const value = joinPathFragments(
      offsetFromRoot(projectRoot),
      options.outputDir
    );
    args.push(`--output-dir=${value}`);
    delete options.outputDir;
  }
  options.args = args;
  processGenericOptions(tree, options, projectName, projectRoot, migrationLogs);
}
