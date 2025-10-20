import { h3, unorderedList } from 'markdown-factory';
import { MigrationContext, MigrationStep } from './types';

/**
 * Migration: Lint targets are not inferred by @nx/dotnet. Existing users of @nx-dotnet/core may need to manually configure lint targets.
 */
export function migrateLintTarget(context: MigrationContext): MigrationStep {
  return {
    completed: [],
    manualSteps: [
      h3(
        '`dotnet format` lint targets',
        'The @nx/dotnet plugin does not infer lint targets. If you were using lint targets with @nx-dotnet/core to enforce code formatting, you will need to either:',
        unorderedList(
          'configure the targets manually on a per-project basis',
          'use a custom plugin',
          'migrate to running `dotnet format` directly'
        )
      ),
    ],
  };
}
