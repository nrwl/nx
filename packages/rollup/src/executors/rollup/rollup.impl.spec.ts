import { ExecutorContext } from '@nx/devkit';
import * as rollup from 'rollup';
import { RollupExecutorOptions } from './schema';
import { createRollupOptions } from './rollup.impl';
import { normalizeRollupExecutorOptions } from './lib/normalize';

jest.mock('rollup-plugin-copy', () => jest.fn());

describe('rollupExecutor', () => {
  let context: ExecutorContext;
  let testOptions: RollupExecutorOptions;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      projectsConfigurations: {
        version: 2,
        projects: {},
      },
      nxJsonConfiguration: {
        npmScope: 'test',
      },
      isVerbose: false,
      projectName: 'example',
      targetName: 'build',
    };
    testOptions = {
      compiler: 'babel',
      main: 'libs/ui/src/index.ts',
      outputPath: 'dist/ui',
      project: 'libs/ui/package.json',
      tsConfig: 'libs/ui/tsconfig.json',
      watch: false,
      format: ['esm', 'cjs'],
    };
  });

  describe('createRollupOptions', () => {
    it('should create rollup options for valid config', () => {
      const result: any = createRollupOptions(
        normalizeRollupExecutorOptions(testOptions, '/root', '/root/src'),
        [],
        context,
        { name: 'example' },
        '/root/src',
        []
      );

      expect(result.map((x) => x.output)).toEqual([
        {
          dir: '/root/dist/ui',
          format: 'esm',
          name: 'Example',
          chunkFileNames: '[name].js',
          entryFileNames: '[name].js',
        },
        {
          dir: '/root/dist/ui',
          format: 'cjs',
          name: 'Example',
          chunkFileNames: '[name].cjs',
          entryFileNames: '[name].cjs',
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
        normalizeRollupExecutorOptions(
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
        normalizeRollupExecutorOptions(
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
          ...normalizeRollupExecutorOptions(testOptions, '/root', '/root/src'),
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

    it(`should treat npm dependencies as external if external is all`, () => {
      const options = createRollupOptions(
        normalizeRollupExecutorOptions(
          { ...testOptions, external: 'all' },
          '/root',
          '/root/src'
        ),
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

    it(`should not treat npm dependencies as external if external is none`, () => {
      const options = createRollupOptions(
        normalizeRollupExecutorOptions(
          { ...testOptions, external: 'none' },
          '/root',
          '/root/src'
        ),
        [],
        context,
        { name: 'example' },
        '/root/src',
        ['lodash']
      );

      const external = options[0].external as rollup.IsExternal;

      expect(external('lodash', '', false)).toBe(false);
      expect(external('lodash/fp', '', false)).toBe(false);
      expect(external('rxjs', '', false)).toBe(false);
    });

    it(`should set external based on options`, () => {
      const options = createRollupOptions(
        normalizeRollupExecutorOptions(
          { ...testOptions, external: ['rxjs'] },
          '/root',
          '/root/src'
        ),
        [],
        context,
        { name: 'example' },
        '/root/src',
        ['lodash']
      );

      const external = options[0].external as rollup.IsExternal;

      expect(external('lodash', '', false)).toBe(false);
      expect(external('lodash/fp', '', false)).toBe(false);
      expect(external('rxjs', '', false)).toBe(true);
    });
  });
});
