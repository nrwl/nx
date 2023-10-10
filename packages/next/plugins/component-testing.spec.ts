import { NxComponentTestingOptions } from '@nx/cypress/plugins/cypress-preset';
import { nxComponentTestingPreset } from './component-testing';

describe('nxComponentTestingPreset', () => {
  describe('compiler', () => {
    it('should default to swc', () => {
      const result = nxComponentTestingPreset(__filename, {});

      expect(
        result.devServer.webpackConfig.module.rules.some((rule: any) =>
          rule.loader?.includes('swc-loader')
        )
      ).toBe(true);

      expect(
        result.devServer.webpackConfig.module.rules.some((rule: any) =>
          rule.loader?.includes('babel')
        )
      ).toBe(false);
    });

    it('set compiler to swc contains swc', () => {
      const options: NxComponentTestingOptions = {
        compiler: 'swc',
      };

      const result = nxComponentTestingPreset(__filename, options);

      expect(
        result.devServer.webpackConfig.module.rules.some((rule: any) =>
          rule.loader?.includes('swc-loader')
        )
      ).toBe(true);

      expect(
        result.devServer.webpackConfig.module.rules.some((rule: any) =>
          rule.loader?.includes('web-babel-loader')
        )
      ).toBe(false);
    });

    it('set compiler to babel contains babel', () => {
      const options: NxComponentTestingOptions = {
        compiler: 'babel',
      };

      const result = nxComponentTestingPreset(__filename, options);

      expect(
        result.devServer.webpackConfig.module.rules.some((rule: any) =>
          rule.loader?.includes('web-babel-loader')
        )
      ).toBe(true);

      expect(
        result.devServer.webpackConfig.module.rules.some((rule: any) =>
          rule.loader?.includes('swc-loader')
        )
      ).toBe(false);
    });
  });
});
