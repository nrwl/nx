import { basename, dirname, join } from 'node:path';
import { reservePort } from './port-utils';
import { updateFile } from './file-utils';

export async function configureCypressComponentTesting(
  configPath: string
): Promise<string> {
  if (!process.env.NX_E2E_PORT_POOL) return '';

  const port = await reservePort();
  const configFile = 'cypress.port.config.ts';
  updateFile(
    join(dirname(configPath), configFile),
    `const config = require(${JSON.stringify(`./${basename(configPath)}`)});
if (config.port != null || process.env.CYPRESS_PORT != null) {
  throw new Error('Cypress must choose its runner port when reserving a component server port');
}
const component = config.component;
const devServer = component?.devServer;
if (devServer?.bundler !== 'webpack' || !devServer.webpackConfig) {
  throw new Error('Expected a Webpack component testing configuration');
}
module.exports = {
  ...config,
  component: {
    ...component,
    devServer: {
      ...devServer,
      webpackConfig: async () => {
        const webpackConfig = typeof devServer.webpackConfig === 'function'
          ? await devServer.webpackConfig()
          : devServer.webpackConfig;
        return {
          ...webpackConfig,
          devServer: { ...webpackConfig.devServer, port: ${port} },
        };
      },
    },
  },
};
`
  );
  return `--config-file=${configFile}`;
}
