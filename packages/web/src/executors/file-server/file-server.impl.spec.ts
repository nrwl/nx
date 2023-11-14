import { ExecutorContext } from '@nx/devkit';
import { normalizeOptions } from './file-server.impl';
import { Schema } from './schema';

describe('file-server impl', () => {
  describe('normalizeOptions', () => {
    it('should normalize build target', () => {
      const context: ExecutorContext = {
        root: '/',
        cwd: '/',
        isVerbose: false,
        projectGraph: {
          nodes: {
            root: {
              data: {
                targets: {
                  build: { configurations: 'production' },
                  'build:test': {},
                },
              },
            } as any,
          },
          dependencies: {},
        },
        projectName: 'root',
      };
      expect(
        normalizeOptions({ buildTarget: 'build' } as Schema, context)
      ).toEqual({
        buildTarget: 'root:build',
      });
      expect(
        normalizeOptions({ buildTarget: 'root:build' } as Schema, context)
      ).toEqual({
        buildTarget: 'root:build',
      });
      expect(
        normalizeOptions({ buildTarget: 'build:production' } as Schema, context)
      ).toEqual({
        buildTarget: 'root:build:production',
      });
      expect(
        normalizeOptions(
          { buildTarget: 'root:build:production' } as Schema,
          context
        )
      ).toEqual({
        buildTarget: 'root:build:production',
      });
      expect(
        normalizeOptions({ buildTarget: 'build:test' } as Schema, context)
      ).toEqual({
        buildTarget: 'root:build:test',
      });
    });
  });
});
