let mockCopyPlugin = jest.fn();
jest.mock('rollup-plugin-copy', () => mockCopyPlugin);
jest.mock('tsconfig-paths-webpack-plugin');

import { ExecutorContext } from '@nrwl/devkit';
import { createRollupOptions } from './package.impl';
import { PackageBuilderOptions } from '../../utils/types';
import { normalizePackageOptions } from '../../utils/normalize';
import * as rollup from 'rollup';

describe('packageExecutor', () => {
  let context: ExecutorContext;
  let testOptions: PackageBuilderOptions;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      workspace: {
        version: 2,
        projects: {},
      },
      isVerbose: false,
      projectName: 'example',
      targetName: 'build',
    };
    testOptions = {
      entryFile: 'libs/ui/src/index.ts',
      outputPath: 'dist/ui',
      project: 'libs/ui/package.json',
      tsConfig: 'libs/ui/tsconfig.json',
      watch: false,
    };
  });

  describe('createRollupOptions', () => {
    it('should work', () => {
      const result: any = createRollupOptions(
        normalizePackageOptions(testOptions, '/root', '/root/src'),
        [],
        context,
        { name: 'example' },
        '/root/src',
        []
      );
      expect(result.map((x) => x.output)).toEqual([
        {
          file: '/root/dist/ui/example.umd.js',
          format: 'umd',
          globals: {},
          name: 'Example',
        },
        {
          file: '/root/dist/ui/example.esm.js',
          format: 'esm',
          globals: {},
          name: 'Example',
        },
      ]);
    });

    it('should handle custom config path', async () => {
      jest.mock(
        '/root/custom-rollup.config.ts',
        () => (o) => ({ ...o, prop: 'my-val' }),
        { virtual: true }
      );
      const result: any = createRollupOptions(
        normalizePackageOptions(
          { ...testOptions, rollupConfig: 'custom-rollup.config.ts' },
          '/root',
          '/root/src'
        ),
        [],
        context,
        { name: 'example' },
        '/root/src',
        []
      );
      expect(result.map((x) => x.prop)).toEqual(['my-val', 'my-val']);
    });

    it('should handle multiple custom config paths in order', async () => {
      jest.mock(
        '/root/custom-rollup-1.config.ts',
        () => (o) => ({ ...o, prop1: 'my-val' }),
        { virtual: true }
      );
      jest.mock(
        '/root/custom-rollup-2.config.ts',
        () => (o) => ({
          ...o,
          prop1: o.prop1 + '-my-val-2',
          prop2: 'my-val-2',
        }),
        { virtual: true }
      );
      const result: any = createRollupOptions(
        normalizePackageOptions(
          {
            ...testOptions,
            rollupConfig: [
              'custom-rollup-1.config.ts',
              'custom-rollup-2.config.ts',
            ],
          },
          '/root',
          '/root/src'
        ),
        [],
        context,
        { name: 'example' },
        '/root/src',
        []
      );
      expect(result.map((x) => x.prop1)).toEqual([
        'my-val-my-val-2',
        'my-val-my-val-2',
      ]);
      expect(result.map((x) => x.prop2)).toEqual(['my-val-2', 'my-val-2']);
    });

    it(`should always use forward slashes for asset paths`, () => {
      createRollupOptions(
        {
          ...normalizePackageOptions(testOptions, '/root', '/root/src'),
          assets: [
            {
              glob: 'README.md',
              input: 'C:\\windows\\path',
              output: '.',
            },
          ],
        },
        [],
        context,
        { name: 'example' },
        '/root/src',
        []
      );
      expect(mockCopyPlugin).toHaveBeenCalledWith({
        targets: [{ dest: '/root/dist/ui', src: 'C:/windows/path/README.md' }],
      });
    });

    it(`should treat npm dependencies as external`, () => {
      const options = createRollupOptions(
        normalizePackageOptions(testOptions, '/root', '/root/src'),
        [],
        context,
        { name: 'example' },
        '/root/src',
        ['lodash']
      );

      const external = options[0].external as rollup.IsExternal;

      expect(external('lodash', '', false)).toBe(true);
      expect(external('lodash/fp', '', false)).toBe(true);
      expect(external('rxjs', '', false)).toBe(false);
    });
  });
});
