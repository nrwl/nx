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
    const syncChanges = await getSyncGeneratorChanges(syncGenerators);

    if (!syncChanges.length) {
      return 0;
    }

    if (options.check) {
      output.error({
        title: `The workspace is out of sync`,
        bodyLines: [
          `The following files must be updated:\n${syncChanges
            .map((c) => c.path)
            .join('\n')}`,
        ],
      });

      return 1;
    }

    flushChanges(workspaceRoot, syncChanges);

    return 0;
  });
}
