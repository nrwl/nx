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
      const b = new Date();
      await buildProjectGraphWithoutDaemon();
      const a = new Date();
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(
          `Nx project graph has been precomputed in ${
            a.getTime() - b.getTime()
          }ms`
        );
      }
    }
  } catch (e) {
    // Do not error since this runs in a postinstall
  }
})();
