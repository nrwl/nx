import { startDevServer } from '@cypress/webpack-dev-server';
import { Configuration } from 'webpack';
import { buildBaseWebpackConfig } from '../utils/webpack';

export function componentDevServer(
  tsConfigPath = 'tsconfig.cy.json',
  compiler: 'swc' | 'babel' = 'babel',
  extendWebpackConfig?: (config: Configuration) => Configuration
): (
  cypressDevServerConfig,
  devServerConfig
) => ReturnType<typeof startDevServer> {
  const NODE_ENV = 'test';

  if (!process.env.BABEL_ENV) {
    process.env.BABEL_ENV = NODE_ENV;
  }

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = NODE_ENV;
  }

  let webpackConfig = buildBaseWebpackConfig({
    tsConfigPath,
    compiler,
    preset: 'react',
  });

  if (extendWebpackConfig) {
    webpackConfig = extendWebpackConfig(webpackConfig);
  }

  return (cypressDevServerConfig, devServerConfig) =>
    startDevServer({
      options: cypressDevServerConfig,
      webpackConfig: webpackConfig as never,
    });
}
