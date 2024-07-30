import { flushChanges } from '../../generators/tree';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import {
  collectAllRegisteredSyncGenerators,
  getSyncGeneratorChanges,
} from '../../utils/sync-generators';
import { workspaceRoot } from '../../utils/workspace-root';
import type { SyncOptions } from './command-object';
import chalk = require('chalk');

export function addHandler(options: SyncOptions): Promise<number> {
  if (options.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';

  return handleErrors(isVerbose, async () => {
    const projectGraph = await createProjectGraphAsync();
    const syncGenerators = await collectAllRegisteredSyncGenerators(
      projectGraph
    );
    const results = await getSyncGeneratorChanges(syncGenerators);

    if (!results.length) {
      return 0;
    }

    if (options.check) {
      const bodyLines: string[] = [];
      for (const result of results) {
        bodyLines.push(
          `${result.generatorName}: ${chalk.bold(
            result.changes.length
          )} file(s) out of sync`
        );
        if (result.outOfSyncMessage) {
          bodyLines.push(result.outOfSyncMessage);
        }
      }

      output.error({
        title: `The workspace is out of sync`,
        bodyLines,
      });

      return 1;
    }

    flushChanges(
      workspaceRoot,
      results.flatMap((c) => c.changes)
    );

    return 0;
  });
}
