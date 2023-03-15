import { NextConfigComplete } from 'next/dist/server/config-shared';
import { getNextConfig } from './with-nx';

describe('withNx', () => {
  describe('svgr', () => {
    it('should be used by default', () => {
      const config = getNextConfig();

      const result = config.webpack(
        {
          module: { rules: [{ oneOf: [] }] },
        },
        {
          buildId: 'build-id',
          config: config as NextConfigComplete,
          dev: true,
          dir: 'dir',
          isServer: false,
          totalPages: 0,
          webpack: undefined,
          defaultLoaders: {
            babel: {
              options: {},
            },
          },
        }
      );

      expect(
        result.module.rules.some((rule) => rule.test?.test('cat.svg'))
      ).toBe(true);
    });

    it('should not be used when disabled', () => {
      const config = getNextConfig({
        nx: {
          svgr: false,
        },
      });

      const result = config.webpack(
        {
          module: { rules: [{ oneOf: [] }] },
        },
        {
          buildId: 'build-id',
          config: config as NextConfigComplete,
          dev: true,
          dir: 'dir',
          isServer: false,
          totalPages: 0,
          webpack: undefined,
          defaultLoaders: {
            babel: {
              options: {},
            },
          },
        }
      );

      expect(
        result.module.rules.some((rule) => rule.test?.test('cat.svg'))
      ).toBe(false);
    });
  });
});
