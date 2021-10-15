import { ExecutorContext } from '@nrwl/devkit';
import * as rollup from 'rollup';
import { WebPackageOptions } from './schema';
import { createRollupOptions } from './package.impl';
import { normalizePackageOptions } from './lib/normalize';

jest.mock('rollup-plugin-copy', () => jest.fn());

describe('packageExecutor', () => {
  let context: ExecutorContext;
  let testOptions: WebPackageOptions;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      workspace: {
        version: 2,
        projects: {},
        npmScope: 'test',
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
      format: ['esm', 'umd'],
    };
  });

  describe('createRollupOptions', () => {
    it('should create rollup options for valid config', () => {
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
          file: '/root/dist/ui/example.esm.js',
          format: 'esm',
          globals: { 'react/jsx-runtime': 'jsxRuntime' },
          name: 'Example',
        },
        {
          file: '/root/dist/ui/example.umd.js',
          format: 'umd',
          globals: { 'react/jsx-runtime': 'jsxRuntime' },
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

      expect(require('rollup-plugin-copy')).toHaveBeenCalledWith({
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
