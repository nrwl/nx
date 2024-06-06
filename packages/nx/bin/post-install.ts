import { buildProjectGraphAndSourceMapsWithoutDaemon } from '../src/project-graph/project-graph';
import { workspaceRoot } from '../src/utils/workspace-root';
import { fileExists } from '../src/utils/fileutils';
import { join } from 'path';
import { daemonClient } from '../src/daemon/client/client';
import { assertSupportedPlatform } from '../src/native/assert-supported-platform';
import { verifyOrUpdateNxCloudClient } from '../src/nx-cloud/update-manager';
import { getCloudOptions } from '../src/nx-cloud/utilities/get-cloud-options';
import { isNxCloudUsed } from '../src/utils/nx-cloud-utils';
import { readNxJson } from '../src/config/nx-json';
import { setupWorkspaceContext } from '../src/utils/workspace-context';
import { logger } from '../src/utils/logger';

(async () => {
  const start = new Date();
  try {
    setupWorkspaceContext(workspaceRoot);
    if (isMainNxPackage() && fileExists(join(workspaceRoot, 'nx.json'))) {
      assertSupportedPlatform();

      try {
        await daemonClient.stop();
      } catch (e) {}
      const tasks: Array<Promise<any>> = [
        buildProjectGraphAndSourceMapsWithoutDaemon(),
      ];
      if (isNxCloudUsed(readNxJson())) {
        tasks.push(verifyOrUpdateNxCloudClient(getCloudOptions()));
      }
      await Promise.all(
        tasks.map((promise) => {
          return promise.catch((e) => {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
              console.warn(e);
            }
          });
        })
      );
    }
  } catch (e) {
    logger.verbose(e);
  } finally {
    const end = new Date();
    logger.verbose(
      `Nx postinstall steps took ${end.getTime() - start.getTime()}ms`
    );

    process.exit(0);
  }
})();

function isMainNxPackage() {
  const mainNxPath = require.resolve('nx', {
    paths: [workspaceRoot],
  });
  const thisNxPath = require.resolve('nx');
  return mainNxPath === thisNxPath;
}
