import { buildProjectGraphWithoutDaemon } from '../src/project-graph/project-graph';
import { workspaceRoot } from '../src/utils/workspace-root';
import { fileExists } from '../src/utils/fileutils';
import { join } from 'path';
import { daemonClient } from '../src/daemon/client/client';
import { assertSupportedPlatform } from '../src/native/assert-supported-platform';

(async () => {
  try {
    if (isMainNxPackage() && fileExists(join(workspaceRoot, 'nx.json'))) {
      assertSupportedPlatform();

      try {
        await daemonClient.stop();
      } catch (e) {}
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
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(e);
    }
  }
})();

function isMainNxPackage() {
  const mainNxPath = require.resolve('nx', {
    paths: [workspaceRoot],
  });
  const thisNxPath = require.resolve('nx');
  return mainNxPath === thisNxPath;
}
