import { type Tree, readNxJson } from '@nx/devkit';
import {
  getE2EWebServerInfo,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';

export async function getRsbuildE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean,
  e2ePortOverride?: number
) {
  const nxJson = readNxJson(tree);
  let e2ePort = e2ePortOverride ?? 4200;
  const devPort = readTargetDefaultsForTarget('dev', nxJson.targetDefaults)
    ?.options?.port;

  if (devPort) {
    e2ePort = devPort;
  }

  return getE2EWebServerInfo(
    tree,
    projectName,
    {
      plugin: '@nx/rsbuild',
      serveTargetName: 'devTargetName',
      serveStaticTargetName: 'previewTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: 'dev',
      defaultServeStaticTargetName: 'preview',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: `http://localhost:${e2ePort}`,
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}
