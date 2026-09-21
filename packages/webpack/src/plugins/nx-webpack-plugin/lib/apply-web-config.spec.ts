import { Configuration } from 'webpack';

import { NormalizedNxAppWebpackPluginOptions } from '../nx-app-webpack-plugin-options';
import { applyWebConfig } from './apply-web-config';

const MinimizerPlugin =
  require('minimizer-webpack-plugin') as typeof import('minimizer-webpack-plugin');

describe('apply-web-config minimizer', () => {
  let options: NormalizedNxAppWebpackPluginOptions;
  let config: Partial<Configuration>;

  beforeEach(() => {
    options = {
      root: '/test',
      projectRoot: 'apps/test',
      sourceRoot: 'apps/test/src',
      target: 'web',
      optimization: true,
      extractCss: false,
      generateIndexHtml: false,
      ssr: true,
    } as NormalizedNxAppWebpackPluginOptions;

    config = {
      entry: {},
      module: { rules: [] },
      optimization: { minimizer: [] },
      resolve: {},
    };
    global.NX_GRAPH_CREATION = false;
  });

  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
  });

  it('should configure cssnano when style optimization is enabled', () => {
    applyWebConfig(options, config);

    const cssMinimizer = config.optimization.minimizer.find(
      (minimizer) => minimizer instanceof MinimizerPlugin
    ) as InstanceType<typeof MinimizerPlugin>;

    expect(cssMinimizer).toBeDefined();
    expect(cssMinimizer.options.test).toEqual(/\.(?:css|scss|sass|less)$/);
    expect(cssMinimizer.options.minimizer.implementation).toBe(
      MinimizerPlugin.cssnanoMinify
    );
  });

  it('should not add a css minimizer when style optimization is disabled', () => {
    options.optimization = false;

    applyWebConfig(options, config);

    expect(config.optimization.minimizer).not.toEqual(
      expect.arrayContaining([expect.any(MinimizerPlugin)])
    );
  });
});
