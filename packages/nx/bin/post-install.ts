import { buildProjectGraphAndSourceMapsWithoutDaemon } from '../src/project-graph/project-graph.js';
import { workspaceRoot } from '../src/utils/workspace-root.js';
import { fileExists } from '../src/utils/fileutils.js';
import { join } from 'path';
import { daemonClient } from '../src/daemon/client/client.js';
import { assertSupportedPlatform } from '../src/native/assert-supported-platform.js';
import { verifyOrUpdateNxCloudClient } from '../src/nx-cloud/update-manager.js';
import { getCloudOptions } from '../src/nx-cloud/utilities/get-cloud-options.js';
import { isNxCloudUsed } from '../src/utils/nx-cloud-utils.js';
import { readNxJson } from '../src/config/nx-json.js';
import { logger } from '../src/utils/logger.js';
import { setupWorkspaceContext } from '../src/utils/workspace-context.js';

// The post install is not critical, to avoid any chance that it may hang
// we will kill this process after 30 seconds.
const postinstallTimeout = setTimeout(() => {
  logger.verbose('Nx post-install timed out.');
  process.exit(0);
}, 30_000);

(async () => {
  const start = new Date();
  try {
    if (isMainNxPackage() && fileExists(join(workspaceRoot, 'nx.json'))) {
      assertSupportedPlatform();

      if (isNxCloudUsed(readNxJson())) {
        await verifyOrUpdateNxCloudClient(getCloudOptions());
      }
    }
  } catch (e) {
    logger.verbose(e);
  } finally {
    const end = new Date();
    logger.verbose(
      `Nx postinstall steps took ${end.getTime() - start.getTime()}ms`
    );

    clearTimeout(postinstallTimeout);
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

process.on('uncaughtException', (e) => {
  logger.verbose(e);
  process.exit(0);
});

process.on('unhandledRejection', (e) => {
  logger.verbose(e);
  process.exit(0);
});
