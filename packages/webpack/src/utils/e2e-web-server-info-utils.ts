import { type Tree, readNxJson } from '@nx/devkit';
import {
  getE2EWebServerInfo,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';

export async function getWebpackE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean,
  e2ePortOverride?: number
) {
  const nxJson = readNxJson(tree);
  let e2ePort = e2ePortOverride ?? 4200;
  const servePort = readTargetDefaultsForTarget('serve', nxJson.targetDefaults)
    ?.options?.port;

  if (servePort) {
    e2ePort = servePort;
  }

  return getE2EWebServerInfo(
    tree,
    projectName,
    {
      plugin: '@nx/webpack/plugin',
      serveTargetName: 'serveTargetName',
      serveStaticTargetName: 'serveStaticTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: 'serve',
      defaultServeStaticTargetName: 'serve-static',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: `http://localhost:${e2ePort}`,
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}
