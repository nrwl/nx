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

  // targetDefaults is a workspace-wide fallback, so it fills in only when the caller
  // did not ask for a port. Letting it win over an explicit request would point e2e at
  // a different port than the serve target the generator just wrote.
  if (servePort && e2ePortOverride == null) {
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
      e2EPortIsExplicit: e2ePortOverride != null,
    },
    isPluginBeingAdded
  );
}
