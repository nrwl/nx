import { NextConfigComplete } from 'next/dist/server/config-shared';
import { getAliasForProject, getNextConfig } from './with-nx';

describe('getNextConfig', () => {
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

describe('getAliasForProject', () => {
  it('should return the matching alias for a project', () => {
    const paths = {
      '@x/proj1': ['packages/proj1'],
      // customized lookup paths with relative path syntax
      '@x/proj2': ['./something-else', './packages/proj2'],
    };

    expect(
      getAliasForProject(
        {
          name: 'proj1',
          type: 'lib',
          data: {
            root: 'packages/proj1',
          },
        },
        paths
      )
    ).toEqual('@x/proj1');

    expect(
      getAliasForProject(
        {
          name: 'proj2',
          type: 'lib',
          data: {
            root: 'packages/proj2', // relative path
          },
        },
        paths
      )
    ).toEqual('@x/proj2');

    expect(
      getAliasForProject(
        {
          name: 'no-alias',
          type: 'lib',
          data: {
            root: 'packages/no-alias',
          },
        },
        paths
      )
    ).toEqual(null);
  });
});
