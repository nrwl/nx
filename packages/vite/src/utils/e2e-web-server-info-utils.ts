import { type Tree, getE2EWebServerInfo } from '@nx/devkit';

export async function getViteWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean,
  e2ePortOverride?: number
) {
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
      defaultE2EWebServerAddress: `http://localhost:${e2ePortOverride ?? 4200}`,
      defaultE2ECiBaseUrl: 'http://localhost:4300',
    },
    isPluginBeingAdded
  );
}
