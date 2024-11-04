import { logger, Tree, updateJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { WebDevServerOptions } from '../../executors/dev-server/schema';

export default async function update(tree: Tree): Promise<void> {
  const unmigratedConfigs: string[] = [];
  const migrate = (options: WebDevServerOptions) => {
    if (!options.proxyConfig) return;
    if (options.proxyConfig.endsWith('.json')) {
      updateJson(tree, options.proxyConfig, (json) => {
        if (Array.isArray(json)) return json;
        if (typeof json === 'object') {
          return Object.keys(json).map((context) => ({
            context: [context],
            ...json[context],
          }));
        }
        return json;
      });
    } else {
      // For non-JSON files, it's not possible to automatically update the proxy config
      // since its content can vary greatly.
      unmigratedConfigs.push(options.proxyConfig);
    }
  };

  forEachExecutorOptions<WebDevServerOptions>(
    tree,
    '@nx/webpack:dev-server',
    migrate
  );

  // React dev-server calls Webpack dev-server.
  forEachExecutorOptions<WebDevServerOptions>(
    tree,
    '@nx/react:module-federation-dev-server',
    migrate
  );

  if (unmigratedConfigs.length > 0) {
    logger.warn(`Some proxy config files need to be updated manually.
  ${unmigratedConfigs.join('\n  ')}
  
Webpack-dev-server v5 changed the proxy config schema to accept only an array.

For example, if you had the following:

"proxy": {
  "/api": { 
    "target": "http://localhost:3000"
   }
}

It needs to be updated to:

"proxy": [{
  "context": ["/api"],
  "target": "http://localhost:3000"
}]

More information: https://github.com/webpack/webpack-dev-server/blob/master/migration-v5.md
`);
  }
}
