jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');
jest.mock('@nrwl/tao/src/utils/fileutils');
jest.mock('@nrwl/workspace/src/utilities/typescript/compilation');

import { ExecutorContext } from '@nrwl/devkit';
import { readJsonFile } from '@nrwl/tao/src/utils/fileutils';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { compileTypeScript } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';
import { normalizeOptions, tscExecutor } from './tsc.impl';

describe('executor: tsc', () => {
  const assets = ['some-file.md'];
  let context: ExecutorContext;
  let sourceRoot: string;
  let root: string;
  let normalizedOptions: NormalizedExecutorOptions;
  let options: ExecutorOptions;
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
    normalizedOptions = normalizeOptions(
      options,
      context.root,
      sourceRoot,
      root
    );
  });

  it('should return { success: false } when dependent projects have not been built', async () => {
    (calculateProjectDependencies as jest.Mock).mockImplementation(() => ({
      target: { data: { root: 'libs/workspacelib' } },
      dependencies: [{}],
    }));
    (checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(false);

    const result = tscExecutor(options, context);

    expect((await result.next()).value).toEqual({ success: false });
    expect(compileTypeScriptMock).not.toHaveBeenCalled();
  });

  it('should return typescript compilation result', async () => {
    const expectedResult = { success: true };
    compileTypeScriptMock.mockReturnValue(expectedResult);

    const result = tscExecutor(options, context);

    expect((await result.next()).value).toEqual({
      ...expectedResult,
      outfile: '/root/dist/libs/workspacelib/src/index.js',
    });
  });
});
