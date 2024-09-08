import { type Tree, readNxJson } from '@nx/devkit';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';

export async function getViteE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean,
  e2ePortOverride?: number
) {
  const nxJson = readNxJson(tree);
  let e2ePort = e2ePortOverride ?? 4200;

  if (
    nxJson.targetDefaults?.['serve'] &&
    nxJson.targetDefaults?.['serve'].options?.port
  ) {
    e2ePort = nxJson.targetDefaults?.['serve'].options?.port;
  }

  return getE2EWebServerInfo(
    tree,
    projectName,
    {
      plugin: '@nx/vite/plugin',
      serveTargetName: 'serveTargetName',
      serveStaticTargetName: 'previewTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: 'serve',
      defaultServeStaticTargetName: 'preview',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: 'http://localhost:4300',
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}
