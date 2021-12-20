jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');
jest.mock('@nrwl/tao/src/utils/fileutils');
jest.mock('../../utils/swc/compile-swc');
jest.mock('../../utils/typescript/run-type-check');

import { ExecutorContext, readJsonFile } from '@nrwl/devkit';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { of } from 'rxjs';
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
  let sourceRoot: string;
  let root: string;
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
    sourceRoot = context.workspace.projects['workspacelib'].sourceRoot;
    root = context.workspace.projects['workspacelib'].root;
    options = {
      assets,
      main: 'libs/workspacelib/src/index.ts',
      outputPath: 'dist/libs/workspacelib',
      tsConfig: 'libs/workspacelib/tsconfig.lib.json',
      watch: false,
      transformers: [],
    };
    normalizedOptions = normalizeSwcOptions(
      options,
      context.root,
      sourceRoot,
      root
    );
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

    const result = swcExecutor(options, context);
    expect((await result.next()).value).toEqual({ success: false });
    expect(compileSwcMock).not.toHaveBeenCalled();
  });

  it('should success if compileSwc success', async () => {
    compileSwcMock.mockImplementationOnce(() => of({ success: true }));
    const result = swcExecutor(options, context);
    expect((await result.next()).value).toEqual({
      success: true,
      outfile: '/root/dist/libs/workspacelib/src/index.js',
    });
    expect(compileSwcMock).toHaveBeenCalledWith(
      context,
      normalizedOptions,
      expect.any(Function)
    );
  });

  describe('without typecheck', () => {
    beforeEach(() => {
      options.skipTypeCheck = true;
      normalizedOptions = normalizeSwcOptions(
        options,
        context.root,
        sourceRoot,
        root
      );
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
  });
});
