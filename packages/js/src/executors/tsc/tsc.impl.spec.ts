import { ExecutorContext } from '@nrwl/devkit';
import { ExecutorOptions } from '../../utils/schema';
import {
  createTypeScriptCompilationOptions,
  normalizeOptions,
} from './tsc.impl';

describe('tscExecutor', () => {
  let context: ExecutorContext;
  let testOptions: ExecutorOptions;

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
      main: 'libs/example/src/index.ts',
      outputPath: 'dist/libs/example',
      tsConfig: 'libs/example/tsconfig.json',
      assets: [],
      transformers: [],
      watch: false,
      clean: true,
    };
  });

  describe('createTypeScriptCompilationOptions', () => {
    it('should create typescript compilation options for valid config', () => {
      const result = createTypeScriptCompilationOptions(
        normalizeOptions(
          testOptions,
          '/root',
          '/root/libs/example/src',
          '/root/libs/example'
        ),
        context
      );

      expect(result).toMatchObject({
        outputPath: '/root/dist/libs/example',
        projectName: 'example',
        projectRoot: '/root/libs/example',
        rootDir: '/root/libs/example',
        tsConfig: '/root/libs/example/tsconfig.json',
        watch: false,
        deleteOutputPath: true,
      });
    });

    it('should handle custom rootDir', () => {
      const result = createTypeScriptCompilationOptions(
        normalizeOptions(
          { ...testOptions, rootDir: 'libs/example/src' },
          '/root',
          '/root/libs/example/src',
          '/root/libs/example'
        ),
        context
      );

      expect(result).toMatchObject({
        rootDir: '/root/libs/example/src',
      });
    });
  });
});
