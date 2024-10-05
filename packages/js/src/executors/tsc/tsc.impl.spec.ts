import { ExecutorContext } from '@nx/devkit';
import { ExecutorOptions } from '../../utils/schema';
import { normalizeOptions } from './lib';
import { createTypeScriptCompilationOptions } from './tsc.impl';

describe('tscExecutor', () => {
  let context: ExecutorContext;
  let testOptions: ExecutorOptions;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      projectGraph: {
        nodes: {},
        dependencies: {},
      },
      projectsConfigurations: {
        version: 2,
        projects: {},
      },
      nxJsonConfiguration: {},
      isVerbose: false,
      projectName: 'example',
      targetName: 'build',
    };
    testOptions = {
      main: 'libs/ui/src/index.ts',
      outputPath: 'dist/libs/ui',
      tsConfig: 'libs/ui/tsconfig.json',
      assets: [],
      transformers: [],
      watch: false,
      clean: true,
    };
  });

  describe('createTypeScriptCompilationOptions', () => {
    it('should create typescript compilation options for valid config', () => {
      const result = createTypeScriptCompilationOptions(
        normalizeOptions(testOptions, '/root', 'libs/ui/src', 'libs/ui'),
        context
      );

      expect(result).toMatchObject({
        outputPath: '/root/dist/libs/ui',
        projectName: 'example',
        projectRoot: 'libs/ui',
        rootDir: '/root/libs/ui',
        tsConfig: '/root/libs/ui/tsconfig.json',
        watch: false,
        deleteOutputPath: true,
      });
    });

    it('should handle custom rootDir', () => {
      const result = createTypeScriptCompilationOptions(
        normalizeOptions(
          { ...testOptions, rootDir: 'libs/ui/src' },
          '/root',
          'libs/ui/src',
          'libs/ui'
        ),
        context
      );

      expect(result).toMatchObject({
        rootDir: '/root/libs/ui/src',
      });
    });
  });
});
