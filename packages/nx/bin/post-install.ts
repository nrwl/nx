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

(async () => {
  try {
    setupWorkspaceContext(workspaceRoot);
    if (isMainNxPackage() && fileExists(join(workspaceRoot, 'nx.json'))) {
      const b = new Date();
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
          promise.catch((e) => {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
              console.warn(e);
            }
          });
        })
      );
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        const a = new Date();
        console.log(`Nx postinstall steps took ${a.getTime() - b.getTime()}ms`);
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
