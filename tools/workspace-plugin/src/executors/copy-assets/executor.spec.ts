import { ExecutorContext, readJsonFile } from '@nx/devkit';
import * as fs from 'fs';
import * as path from 'path';
import { copyAssetsExecutor, CopyAssetsExecutorOptions } from './executor';

jest.mock('@nx/js/src/utils/assets/copy-assets-handler');
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  readJsonFile: jest.fn(),
}));
jest.mock('fs');

describe('CopyAssets Executor', () => {
  let context: ExecutorContext;
  let options: CopyAssetsExecutorOptions;

  beforeEach(() => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});

    context = {
      root: '/root',
      projectName: 'test-project',
      targetName: 'copy-assets',
      configurationName: undefined,
      projectGraph: {
        nodes: {
          'test-project': {
            type: 'lib',
            name: 'test-project',
            data: {
              root: 'packages/test-project',
              sourceRoot: 'packages/test-project/src',
              targets: {},
            },
          },
        },
        dependencies: {},
      },
    } as any;

    options = {
      assets: ['README.md', { input: 'src', glob: '**/*.txt', output: 'docs' }],
      outputPath: 'dist/packages/test-project',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should execute successfully with assets', async () => {
    const CopyAssetsHandler =
      require('@nx/js/src/utils/assets/copy-assets-handler').CopyAssetsHandler;
    const mockProcessAllAssetsOnce = jest.fn().mockResolvedValue(undefined);

    CopyAssetsHandler.mockImplementation(() => ({
      processAllAssetsOnce: mockProcessAllAssetsOnce,
    }));

    const result = await copyAssetsExecutor(options, context);

    expect(result).toEqual({ success: true });
    expect(mockProcessAllAssetsOnce).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.resolve(
        '/root',
        'packages/test-project',
        'dist/packages/test-project'
      ),
      { recursive: true }
    );
  });

  it('should handle no assets gracefully', async () => {
    options.assets = [];

    const result = await copyAssetsExecutor(options, context);

    expect(result).toEqual({ success: true });
  });

  it('should handle errors appropriately', async () => {
    const CopyAssetsHandler =
      require('@nx/js/src/utils/assets/copy-assets-handler').CopyAssetsHandler;
    const mockProcessAllAssetsOnce = jest
      .fn()
      .mockRejectedValue(new Error('Copy failed'));

    CopyAssetsHandler.mockImplementation(() => ({
      processAllAssetsOnce: mockProcessAllAssetsOnce,
    }));

    const result = await copyAssetsExecutor(options, context);

    expect(result).toEqual({ success: false });
  });

  it('should derive output path from tsConfig when outputPath is not provided', async () => {
    const CopyAssetsHandler =
      require('@nx/js/src/utils/assets/copy-assets-handler').CopyAssetsHandler;
    const mockProcessAllAssetsOnce = jest.fn().mockResolvedValue(undefined);

    CopyAssetsHandler.mockImplementation(() => ({
      processAllAssetsOnce: mockProcessAllAssetsOnce,
    }));

    (readJsonFile as jest.Mock).mockReturnValue({
      compilerOptions: {
        outDir: '../../dist/packages/test-project',
      },
    });

    delete options.outputPath;
    options.tsConfig = 'tsconfig.lib.json';

    const result = await copyAssetsExecutor(options, context);

    expect(result).toEqual({ success: true });
    expect(readJsonFile).toHaveBeenCalledWith(
      path.join('/root', 'packages/test-project', 'tsconfig.lib.json')
    );
  });

  it('should fail when no output path can be determined', async () => {
    delete options.outputPath;

    const result = await copyAssetsExecutor(options, context);

    expect(result).toEqual({ success: false });
  });

  it('should fail when tsConfig has no outDir', async () => {
    (readJsonFile as jest.Mock).mockReturnValue({
      compilerOptions: {
        // No outDir
      },
    });

    delete options.outputPath;
    options.tsConfig = 'tsconfig.lib.json';

    const result = await copyAssetsExecutor(options, context);

    expect(result).toEqual({ success: false });
  });
});
