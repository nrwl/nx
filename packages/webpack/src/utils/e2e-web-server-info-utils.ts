import { type Tree, getE2EWebServerInfo } from '@nx/devkit';

export async function getWebpackWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean
) {
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
      defaultE2EWebServerAddress: 'http://localhost:4200',
      defaultE2ECiBaseUrl: 'http://localhost:4200',
    },
    isPluginBeingAdded
  );
}
