import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';

export function addProxyConfig(host: Tree, options: NormalizedSchema) {
  const projectConfig = readProjectConfiguration(host, options.name);

  if (projectConfig.targets && projectConfig.targets.serve) {
    const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;

    if (!host.exists(pathToProxyFile)) {
      host.write(pathToProxyFile, '{}');
    }

    updateJson(host, pathToProxyFile, (json) => ({
      [`/${options.backendProject}`]: {
        target: 'http://localhost:3333',
        secure: false,
      },
    }));

    projectConfig.targets.serve.options = {
      ...projectConfig.targets.serve.options,
      proxyConfig: pathToProxyFile,
    };
    updateProjectConfiguration(host, options.name, projectConfig);
  }
}
