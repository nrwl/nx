import { chain } from '@angular-devkit/schematics';
import { formatFiles, updateBuilderConfig } from '@nrwl/workspace';

/**
 * The migration for v10.3.0 called "update-eslint-builder-and-config" initially had a bug
 * where it included files from node_modules in the `lintFilePatterns` option if they were
 * explicitly included in any of the relevant tsconfig files.
 *
 * This has now been fixed in the original migration, but this extra migration will handle
 * fixing up any setups which migrated in the interim and are currently experiencing lint
 * warnings as a result.
 */
function updateESLintBuilder() {
  return updateBuilderConfig((options) => {
    const lintFilePatterns: string[] =
      (options.lintFilePatterns as string[]) || [];
    return {
      ...options,
      lintFilePatterns: lintFilePatterns.filter(
        (pattern) => !pattern.includes('node_modules')
      ),
    };
  }, '@nrwl/linter:eslint');
}

export default function () {
  return chain([updateESLintBuilder, formatFiles()]);
}
