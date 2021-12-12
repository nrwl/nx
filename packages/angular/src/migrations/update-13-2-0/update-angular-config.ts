import type { Tree } from '@nrwl/devkit';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

import { Schema as WebpackServerOptions } from '../../builders/webpack-server/schema';
import { BrowserBuilderSchema as WebpackBrowserOptions } from '../../builders/webpack-browser/webpack-browser.impl';

export default async function (tree: Tree) {
  forEachExecutorOptions<WebpackServerOptions>(
    tree,
    '@nrwl/angular:webpack-server',
    (options: any, projectName, targetName, configurationName) => {
      const projectConfiguration = readProjectConfiguration(tree, projectName);
      const config = configurationName
        ? projectConfiguration.targets[targetName].configurations[
            configurationName
          ]
        : projectConfiguration.targets[targetName].options;
      delete config.optimization;
      delete config.aot;
      delete config.progress;
      delete config.deployUrl;
      delete config.sourceMap;
      delete config.vendorChunk;
      delete config.commonChunk;
      delete config.baseHref;
      delete config.servePathDefaultWarning;
      delete config.hmrWarning;
      delete config.extractCss;
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  );
  forEachExecutorOptions<WebpackBrowserOptions>(
    tree,
    '@nrwl/angular:webpack-browser',
    (options: any, projectName, targetName, configurationName) => {
      const projectConfiguration = readProjectConfiguration(tree, projectName);
      const config = configurationName
        ? projectConfiguration.targets[targetName].configurations[
            configurationName
          ]
        : projectConfiguration.targets[targetName];
      delete config.extractCss;
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  );
}
