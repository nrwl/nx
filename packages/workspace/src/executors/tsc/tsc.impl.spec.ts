import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { copyAssets } from '../../utilities/assets';
import { readJsonFile, writeJsonFile } from '../../utilities/fileutils';
import { compileTypeScript } from '../../utilities/typescript/compilation';
import { TypeScriptExecutorOptions } from './schema';
import { tscExecutor } from './tsc.impl';

const defaultPackageJson = { name: 'workspacelib', version: '0.0.1' };
jest.mock('../../utilities/fileutils', () => ({
  ...jest.requireActual('../../utilities/fileutils'),
  writeJsonFile: jest.fn(),
  readJsonFile: jest.fn(() => ({ ...defaultPackageJson })),
}));
const readJsonFileMock = readJsonFile as jest.Mock<any>;
jest.mock('../../utilities/typescript/compilation');
const compileTypeScriptMock = compileTypeScript as jest.Mock<{
  success: boolean;
}>;
jest.mock('../../utilities/assets');

describe('executor: tsc', () => {
  const assets = ['some-file.md'];
  let context: ExecutorContext;
  let normalizedOptions: TypeScriptExecutorOptions;
  let options: TypeScriptExecutorOptions;

  beforeEach(() => {
    context = {
      cwd: '/root',
      root: '/root',
      projectName: 'workspacelib',
      targetName: 'build',
      workspace: {
        version: 2,
        projects: {
          workspacelib: {
            root: 'libs/workspacelib',
            sourceRoot: 'libs/workspacelib/src',
            targets: {},
          },
        },
      },
      isVerbose: false,
    };
    options = {
      assets,
      main: 'libs/workspacelib/src/index.ts',
      outputPath: 'dist/libs/workspacelib',
      tsConfig: 'libs/workspacelib/tsconfig.lib.json',
    };
    normalizedOptions = {
      ...options,
      outputPath: join(context.root, options.outputPath),
      tsConfig: join(context.root, options.tsConfig),
    };

    jest.clearAllMocks();
  });

  it('should return typescript compilation result', async () => {
    const expectedResult = { success: true };
    compileTypeScriptMock.mockReturnValue(expectedResult);

    const result = await tscExecutor(options, context);

    expect(result).toBe(expectedResult);
  });

  describe('copy assets', () => {
    it('should not copy assets when typescript compilation is not successful', async () => {
      compileTypeScriptMock.mockReturnValue({ success: false });

      await tscExecutor(options, context);

      expect(copyAssets).not.toHaveBeenCalled();
    });

    it('should copy assets when typescript compilation is successful', async () => {
      compileTypeScriptMock.mockReturnValue({ success: true });

      await tscExecutor(options, context);

      expect(copyAssets).toHaveBeenCalledWith(
        assets,
        context.root,
        normalizedOptions.outputPath
      );
    });
  });

  describe('update package.json', () => {
    it('should not update package.json when typescript compilation is not successful', async () => {
      compileTypeScriptMock.mockReturnValue({ success: false });

      await tscExecutor(options, context);

      expect(writeJsonFile).not.toHaveBeenCalled();
    });

    it('should update the package.json when typescript compilation is successful and both main and typings are missing', async () => {
      compileTypeScriptMock.mockReturnValue({ success: true });

      await tscExecutor(options, context);

      expect(writeJsonFile).toHaveBeenCalledWith(
        join(context.root, options.outputPath, 'package.json'),
        {
          ...defaultPackageJson,
          main: './src/index.js',
          typings: './src/index.d.ts',
        }
      );
    });

    it('should update the package.json when typescript compilation is successful and only main is missing', async () => {
      compileTypeScriptMock.mockReturnValue({ success: true });
      const packageJson = {
        ...defaultPackageJson,
        typings: './src/index.d.ts',
      };
      readJsonFileMock.mockReturnValue(packageJson);

      await tscExecutor(options, context);

      expect(writeJsonFile).toHaveBeenCalledWith(
        join(context.root, options.outputPath, 'package.json'),
        {
          ...packageJson,
          main: './src/index.js',
        }
      );
    });

    it('should update the package.json when typescript compilation is successful and only typings is missing', async () => {
      compileTypeScriptMock.mockReturnValue({ success: true });
      const packageJson = {
        ...defaultPackageJson,
        main: './src/index.js',
      };
      readJsonFileMock.mockReturnValue(packageJson);

      await tscExecutor(options, context);

      expect(writeJsonFile).toHaveBeenCalledWith(
        join(context.root, options.outputPath, 'package.json'),
        {
          ...packageJson,
          typings: './src/index.d.ts',
        }
      );
    });

    it('should not update the package.json when typescript compilation is successful and both main and typings are specified', async () => {
      compileTypeScriptMock.mockReturnValue({ success: true });
      readJsonFileMock.mockReturnValue({
        ...defaultPackageJson,
        main: './src/index.js',
        typings: './src/index.d.ts',
      });

      await tscExecutor(options, context);

      expect(writeJsonFile).not.toHaveBeenCalled();
    });
  });
});
