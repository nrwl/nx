import { withNx } from './with-nx';

describe('withNx', () => {
  describe('svgr', () => {
    it('should be used by default', () => {
      const config = withNx({});

      const result = config.webpack(
        {
          module: { rules: [{ oneOf: [] }] },
        },
        {
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
      const config = withNx({
        nx: {
          svgr: false,
        },
      });

      const result = config.webpack(
        {
          module: { rules: [{ oneOf: [] }] },
        },
        {
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
