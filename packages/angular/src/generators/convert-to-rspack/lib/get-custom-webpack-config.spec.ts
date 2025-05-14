import { convertWebpackConfigToUseNxModuleFederationPlugin } from './get-custom-webpack-config';

describe('convertconvertWebpackConfigToUseNxModuleFederationPlugin', () => {
  it('should convert a basic webpack config to use Nx Module Federation Plugin', () => {
    // ARRANGE
    const webpackConfigContents = `
      import { withModuleFederation } from '@nx/module-federation/angular';
      import config from './module-federation.config';
      export default withModuleFederation(config, { dts: false });
    `;

    // ACT
    const newWebpackConfigContents =
      convertWebpackConfigToUseNxModuleFederationPlugin(webpackConfigContents);

    // ASSERT
    expect(newWebpackConfigContents).toMatchInlineSnapshot(`
      "
            import { NxModuleFederationPlugin, NxModuleFederationDevServerPlugin } from '@nx/module-federation/rspack';
            import config from './module-federation.config';
            
          
          export default {
            plugins: [
              new NxModuleFederationPlugin({ config }, {
                dts: false,
              }),
              new NxModuleFederationDevServerPlugin({ config }),
            ]
          }
          "
    `);
  });

  it('should convert a basic cjs webpack config to use Nx Module Federation Plugin', () => {
    // ARRANGE
    const webpackConfigContents = `
      const { withModuleFederation } = require('@nx/module-federation/angular');
      const config = require('./module-federation.config');
      module.exports = withModuleFederation(config, { dts: false });
    `;

    // ACT
    const newWebpackConfigContents =
      convertWebpackConfigToUseNxModuleFederationPlugin(webpackConfigContents);

    // ASSERT
    expect(newWebpackConfigContents).toMatchInlineSnapshot(`
      "
            const { NxModuleFederationPlugin, NxModuleFederationDevServerPlugin } = require('@nx/module-federation/rspack');
            const config = require('./module-federation.config');
            
          
          module.exports = {
            plugins: [
              new NxModuleFederationPlugin({ config }, {
                dts: false,
              }),
              new NxModuleFederationDevServerPlugin({ config }),
            ]
          }
          "
    `);
  });
});
