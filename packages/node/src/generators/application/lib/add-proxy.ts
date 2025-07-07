import {
  logger,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { NormalizedSchema } from './normalized-schema';

export function addProxy(tree: Tree, options: NormalizedSchema) {
  const projectConfig = readProjectConfiguration(tree, options.frontendProject);
  if (
    projectConfig.targets &&
    ['serve', 'dev'].find((t) => !!projectConfig.targets[t])
  ) {
    const targetName = ['serve', 'dev'].find((t) => !!projectConfig.targets[t]);
    projectConfig.targets[targetName].dependsOn = [
      ...(projectConfig.targets[targetName].dependsOn ?? []),
      `${options.name}:serve`,
    ];
    const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;
    projectConfig.targets[targetName].options = {
      ...projectConfig.targets[targetName].options,
      proxyConfig: pathToProxyFile,
    };

    if (!tree.exists(pathToProxyFile)) {
      tree.write(
        pathToProxyFile,
        JSON.stringify(
          {
            '/api': {
              target: `http://localhost:${options.port}`,
              secure: false,
            },
          },
          null,
          2
        )
      );
    } else {
      //add new entry to existing config
      const proxyFileContent = tree.read(pathToProxyFile).toString();

      const proxyModified = {
        ...JSON.parse(proxyFileContent),
        [`/${options.name}-api`]: {
          target: `http://localhost:${options.port}`,
          secure: false,
        },
      };

      tree.write(pathToProxyFile, JSON.stringify(proxyModified, null, 2));
    }

    updateProjectConfiguration(tree, options.frontendProject, projectConfig);
  } else {
    logger.warn(
      `Skip updating proxy for frontend project "${options.frontendProject}" since "serve" target is not found in project.json. For more information, see: https://nx.dev/recipes/node/application-proxies.`
    );
  }
}
