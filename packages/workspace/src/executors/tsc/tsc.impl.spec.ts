jest.mock('../../core/project-graph');
jest.mock('../../utilities/assets');
jest.mock('../../utilities/buildable-libs-utils');
jest.mock('../../utilities/fileutils');
jest.mock('../../utilities/typescript/compilation');

import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { copyAssets } from '../../utilities/assets';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '../../utilities/buildable-libs-utils';
import { readJsonFile, writeJsonFile } from '../../utilities/fileutils';
import { compileTypeScript } from '../../utilities/typescript/compilation';
import { TypeScriptExecutorOptions } from './schema';
import { tscExecutor } from './tsc.impl';

describe('executor: tsc', () => {
  const assets = ['some-file.md'];
  let context: ExecutorContext;
  let normalizedOptions: TypeScriptExecutorOptions;
  let options: TypeScriptExecutorOptions;
  const defaultPackageJson = { name: 'workspacelib', version: '0.0.1' };
  const compileTypeScriptMock = compileTypeScript as jest.Mock;
  const readJsonFileMock = readJsonFile as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    (calculateProjectDependencies as jest.Mock).mockImplementation(() => ({
      target: { data: { root: 'libs/workspacelib' } },
      dependencies: [],
    }));
    (createTmpTsConfig as jest.Mock).mockImplementation(
      () => '/my-app/tsconfig.app.generated.json'
    );
    (checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(true);
    readJsonFileMock.mockImplementation(() => ({ ...defaultPackageJson }));

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
      nxJson: {
        npmScope: 'test',
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
  });

  it('should return { success: false } when dependent projects have not been built', async () => {
    (calculateProjectDependencies as jest.Mock).mockImplementation(() => ({
      target: { data: { root: 'libs/workspacelib' } },
      dependencies: [{}],
    }));
    (checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(false);

    const result = await tscExecutor(options, context);

    expect(result).toEqual({ success: false });
    expect(compileTypeScriptMock).not.toHaveBeenCalled();
  });

  it('should return typescript compilation result', async () => {
    const expectedResult = { success: true };
    compileTypeScriptMock.mockReturnValue(expectedResult);

    const result = await tscExecutor(options, context);

    expect(result).toBe(expectedResult);
  });

  it('should copy assets before typescript compilation', async () => {
    await tscExecutor(options, context);

    expect(copyAssets).toHaveBeenCalledWith(
      assets,
      context.root,
      normalizedOptions.outputPath
    );
  });

  describe('update package.json', () => {
    it('should update the package.json when both main and typings are missing', async () => {
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

    it('should update the package.json when only main is missing', async () => {
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

    it('should update the package.json when only typings is missing', async () => {
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

    it('should not update the package.json when both main and typings are specified', async () => {
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
