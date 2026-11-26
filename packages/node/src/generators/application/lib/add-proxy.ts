import {
  logger,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { NormalizedSchema } from './normalized-schema';

export function addProxy(tree: Tree, options: NormalizedSchema) {
  const frontendProject = options.frontendProject;
  if (!frontendProject) {
    throw new Error('The "frontendProject" option is required.');
  }
  const projectConfig = readProjectConfiguration(tree, frontendProject);
  const targets = projectConfig.targets;
  const targetName = targets
    ? ['serve', 'dev'].find((t) => !!targets[t])
    : undefined;
  if (targets && targetName) {
    const target = targets[targetName];
    target.dependsOn = [...(target.dependsOn ?? []), `${options.name}:serve`];
    const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;
    target.options = {
      ...target.options,
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
      const proxyFileContent = tree.read(pathToProxyFile, 'utf-8') ?? '';

      const proxyModified = {
        ...JSON.parse(proxyFileContent),
        [`/${options.name}-api`]: {
          target: `http://localhost:${options.port}`,
          secure: false,
        },
      };

      tree.write(pathToProxyFile, JSON.stringify(proxyModified, null, 2));
    }

    updateProjectConfiguration(tree, frontendProject, projectConfig);
  } else {
    logger.warn(
      `Skip updating proxy for frontend project "${frontendProject}" since "serve" target is not found in project.json. For more information, see: https://nx.dev/recipes/node/application-proxies.`
    );
  }
}
