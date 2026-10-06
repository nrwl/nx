import { type Tree, readNxJson } from '@nx/devkit';
import {
  getE2EWebServerInfo,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';

export async function getViteE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean,
  e2ePortOverride?: number,
  e2eCIPortOverride?: number
) {
  const nxJson = readNxJson(tree);
  let e2ePort = e2ePortOverride ?? 4200;
  const devPort = readTargetDefaultsForTarget('dev', nxJson.targetDefaults)
    ?.options?.port;
  const servePort = readTargetDefaultsForTarget('serve', nxJson.targetDefaults)
    ?.options?.port;

  if (devPort || servePort) {
    e2ePort = devPort ?? servePort;
  }

  return getE2EWebServerInfo(
    tree,
    projectName,
    {
      plugin: '@nx/vite/plugin',
      serveTargetName: 'devTargetName',
      serveStaticTargetName: 'previewTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: 'dev',
      defaultServeStaticTargetName: 'preview',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: `http://localhost:${e2eCIPortOverride ?? 4300}`,
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}

export async function getReactRouterE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean,
  e2ePortOverride?: number,
  e2eCIPortOverride?: number
) {
  const e2ePort = e2ePortOverride ?? parseInt(process.env.PORT) ?? 4200;

  return await getE2EWebServerInfo(
    tree,
    projectName,
    {
      plugin: '@nx/react/router-plugin',
      serveTargetName: 'devTargetName',
      serveStaticTargetName: 'devTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: 'dev',
      defaultServeStaticTargetName: 'dev',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: `http://localhost:${e2eCIPortOverride ?? 4200}`,
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}
