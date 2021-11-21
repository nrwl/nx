jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace/src/utilities/assets');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');
jest.mock('@nrwl/tao/src/utils/fileutils');
jest.mock('../../utils/swc/compile-swc');
jest.mock('../../utils/typescript/run-type-check');

import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';
import { copyAssetFiles } from '@nrwl/workspace/src/utilities/assets';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { join } from 'path';
import { compileSwc } from '../../utils/swc/compile-swc';
import { runTypeCheck } from '../../utils/typescript/run-type-check';
import { NormalizedSwcExecutorOptions, SwcExecutorOptions } from './schema';
import {
  normalizeOptions as normalizeSwcOptions,
  swcExecutor,
} from './swc.impl';

describe('executor: swc', () => {
  const assets = ['some-file.md'];
  let options: SwcExecutorOptions;
  let normalizedOptions: NormalizedSwcExecutorOptions;
  let context: ExecutorContext;
  let tsOptions: Record<string, unknown>;
  const defaultPackageJson = { name: 'workspacelib', version: '0.0.1' };
  const compileSwcMock = compileSwc as jest.Mock;
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
    (runTypeCheck as jest.Mock).mockImplementation(() =>
      Promise.resolve({ errors: [] })
    );
    compileSwcMock.mockImplementation((_, postCompilationCallback) =>
      Promise.resolve({ success: true }).then((result) => {
        postCompilationCallback?.();
        return result;
      })
    );
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
    normalizedOptions = normalizeSwcOptions(options, context);
    tsOptions = {
      outputPath: normalizedOptions.outputPath,
      projectName: context.projectName,
      projectRoot: 'libs/workspacelib',
      tsConfig: normalizedOptions.tsConfig,
    };
  });

  it('should return {success: false} if deps have not been built', async () => {
    (calculateProjectDependencies as jest.Mock).mockImplementation(() => ({
      target: { data: { root: 'libs/workspacelib' } },
      dependencies: [{}],
    }));
    (checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(false);

    const result = await swcExecutor(options, context);
    expect(result).toEqual({ success: false });
    expect(compileSwcMock).not.toHaveBeenCalled();
  });

  it('should return {success: false} if typecheck emits errors', async () => {
    (runTypeCheck as jest.Mock).mockImplementation(() =>
      Promise.resolve({ errors: ['error'] })
    );
    const result = await swcExecutor(options, context);
    expect(result).toEqual({ success: false });
    expect(compileSwcMock).toHaveBeenCalledWith(
      tsOptions,
      expect.any(Function)
    );
  });

  it('should success if both typecheck and compileSwc success', async () => {
    const result = await swcExecutor(options, context);
    expect(result).toEqual({ success: true });
    expect(compileSwcMock).toHaveBeenCalledWith(
      tsOptions,
      expect.any(Function)
    );
  });

  it('should copy assets files', async () => {
    await swcExecutor(options, context);
    expect(copyAssetFiles).toHaveBeenCalledWith(normalizedOptions.files);
  });

  it('should update packageJson typings', async () => {
    await swcExecutor(options, context);
    expect(writeJsonFile).toHaveBeenCalledWith(
      join(context.root, options.outputPath, 'package.json'),
      {
        ...defaultPackageJson,
        main: './src/index.js',
        typings: './src/index.d.ts',
      }
    );
  });

  describe('without typecheck', () => {
    beforeEach(() => {
      options.skipTypeCheck = true;
      normalizedOptions = normalizeSwcOptions(options, context);
      tsOptions = {
        outputPath: normalizedOptions.outputPath,
        projectName: context.projectName,
        projectRoot: 'libs/workspacelib',
        tsConfig: normalizedOptions.tsConfig,
      };
    });

    it('should not call runTypeCheck', async () => {
      await swcExecutor(options, context);
      expect(runTypeCheck).not.toHaveBeenCalled();
    });

    it('should success if compileSwc success', async () => {
      const result = await swcExecutor(options, context);
      expect(result).toEqual({ success: true });
      expect(compileSwcMock).toHaveBeenCalledWith(
        tsOptions,
        expect.any(Function)
      );
    });

    it('should not update packageJson typings', async () => {
      await swcExecutor(options, context);
      expect(writeJsonFile).toHaveBeenCalledWith(
        join(context.root, options.outputPath, 'package.json'),
        {
          ...defaultPackageJson,
          main: './src/index.js',
        }
      );
    });
  });
});
