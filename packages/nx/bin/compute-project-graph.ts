import { buildProjectGraphWithoutDaemon } from '../src/project-graph/project-graph';
import { workspaceRoot } from '../src/utils/workspace-root';
import { fileExists } from '../src/utils/fileutils';
import { join } from 'path';
import { isServerAvailable, stop } from '../src/daemon/client/client';

(async () => {
  try {
    if (fileExists(join(workspaceRoot, 'nx.json'))) {
      if (await isServerAvailable()) {
        await stop();
      }
      await buildProjectGraphWithoutDaemon();
    }
  } catch (e) {
    // Do not error since this runs in a postinstall
  }
})();
