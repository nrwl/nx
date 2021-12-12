import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { mocked } from 'ts-jest/utils';

jest.mock('@nrwl/workspace/src/core/project-graph');
import * as projectGraph from '@nrwl/workspace/src/core/project-graph';
import {
  ProjectGraph,
  ProjectType,
} from '@nrwl/workspace/src/core/project-graph';

import { packageExecutor } from './package.impl';
import { NodePackageBuilderOptions } from './utils/models';

jest.mock('glob');
import * as glob from 'glob';

jest.mock('fs-extra');
import * as fs from 'fs-extra';

jest.mock('@nrwl/workspace/src/utilities/fileutils');
import * as fsUtility from '@nrwl/workspace/src/utilities/fileutils';
import * as tsUtils from '@nrwl/workspace/src/utilities/typescript';
import * as ts from 'typescript';

describe('NodePackageBuilder', () => {
  let testOptions: NodePackageBuilderOptions;
  let context: ExecutorContext;

  beforeEach(async () => {
    mocked(fsUtility.readJsonFile).mockImplementation((path: string) => {
      if (path.endsWith('tsconfig.lib.json')) {
        return {
          extends: './tsconfig.json',
          compilerOptions: {
            outDir: '../../dist/out-tsc',
            declaration: true,
            rootDir: './src',
            types: ['node'],
          },
          exclude: ['**/*.spec.ts'],
          include: ['**/*.ts'],
        };
      } else {
        return {
          name: 'nodelib',
        };
      }
    });
    mocked(fsUtility.writeJsonFile).mockImplementation(
      (_: string, _2: unknown) => {
        //empty
        return;
      }
    );
    mocked(fs.existsSync).mockImplementation(
      (path: string) => path === 'libs/nodelib/src/index.ts'
    );
    context = {
      root: '/root',
      cwd: '/root',

      projectName: 'nodelib',
      targetName: 'build',
      workspace: {
        version: 2,
        projects: {
          nodelib: {
            root: 'libs/nodelib',
            sourceRoot: 'libs/nodelib/src',
            targets: {},
          },
        },
        npmScope: 'test',
      },
      isVerbose: false,
    };
    testOptions = {
      assets: [],
      main: 'libs/nodelib/src/index.ts',
      outputPath: 'dist/libs/nodelib',
      packageJson: 'libs/nodelib/package.json',
      tsConfig: 'libs/nodelib/tsconfig.lib.json',
      watch: false,
      sourceMap: false,
      deleteOutputPath: true,
    };
  });

  describe('Without library dependencies', () => {
    beforeEach(() => {
      jest
        .spyOn(projectGraph, 'readCachedProjectGraph')
        .mockImplementation(() => {
          return {
            nodes: {
              nodelib: {
                type: ProjectType.lib,
                name: 'nodelib',
                data: {
                  files: [],
                  root: 'libs/nodelib',
                  targets: { build: { executor: 'any builder' } },
                },
              },
              'nodelib-child': {
                type: ProjectType.lib,
                name: 'nodelib-child',
                data: {
                  files: [],
                  root: 'libs/nodelib-child',
                  prefix: 'proj',
                  targets: {
                    build: {
                      executor: 'any builder',
                      options: {
                        assets: [],
                        main: 'libs/nodelib-child/src/index.ts',
                        outputPath: 'dist/libs/nodelib-child',
                        packageJson: 'libs/nodelib-child/package.json',
                        tsConfig: 'libs/nodelib-child/tsconfig.lib.json',
                      },
                    },
                  },
                },
              },
            },
            dependencies: {
              nodelib: [],
              'nodelib-child': [],
            },
          } as ProjectGraph;
        });
    });

    it('should update the package.json after compiling typescript', async () => {
      await packageExecutor(testOptions, context);
      expect(fsUtility.writeJsonFile).toHaveBeenCalledWith(
        `${testOptions.outputPath}/package.json`,
        {
          name: 'nodelib',
          main: './src/index.js',
          typings: './src/index.d.ts',
        }
      );
    });

    it('should throw an error if `main` entry point does not exist', async () => {
      await expect(
        packageExecutor({ ...testOptions, main: 'does/not/exist.ts' }, context)
      ).rejects.toThrow(
        `Please verify that the "main" option for project "nodelib" is valid.`
      );
    });

    it('should have the output path in the BuilderOutput', async () => {
      const result = await packageExecutor(testOptions, context);

      expect(result.outputPath).toEqual(testOptions.outputPath);
    });

    describe('Asset copying', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should be able to copy assets using the glob object', async () => {
        mocked(glob.sync).mockReturnValue(['logo.png']);
        await packageExecutor(
          {
            ...testOptions,
            assets: [
              {
                glob: '**.*',
                input: 'lib/nodelib/src/assets',
                output: './newfolder',
                ignore: [],
              },
            ],
          },
          context
        );
        expect(fs.copy).toHaveBeenCalledTimes(1);
        expect(fs.copy).toHaveBeenCalledWith(
          `${context.root}/lib/nodelib/src/assets/logo.png`,
          `${context.root}/${testOptions.outputPath}/newfolder/logo.png`
        );
      });
      it('should be able to copy assets with a regular string', async () => {
        mocked(glob.sync).mockReturnValue(['lib/nodelib/src/LICENSE']);

        await packageExecutor(
          {
            ...testOptions,
            assets: ['lib/nodelib/src/LICENSE'],
          },
          context
        );

        expect(fs.copy).toHaveBeenCalledTimes(1);
        expect(fs.copy).toHaveBeenCalledWith(
          `${context.root}/lib/nodelib/src/LICENSE`,
          `${context.root}/${testOptions.outputPath}/LICENSE`
        );
      });

      it('should be able to copy assets with a glob string', async () => {
        mocked(glob.sync).mockReturnValue([
          'lib/nodelib/src/README.md',
          'lib/nodelib/src/CONTRIBUTING.md',
        ]);
        await packageExecutor(
          {
            ...testOptions,
            assets: ['lib/nodelib/src/*.MD'],
          },
          context
        );

        expect(fs.copy).toHaveBeenCalledTimes(2);
        expect(fs.copy).toHaveBeenCalledWith(
          `${context.root}/lib/nodelib/src/README.md`,
          `${context.root}/${testOptions.outputPath}/README.md`
        );
        expect(fs.copy).toHaveBeenCalledWith(
          `${context.root}/lib/nodelib/src/CONTRIBUTING.md`,
          `${context.root}/${testOptions.outputPath}/CONTRIBUTING.md`
        );
      });
    });

    describe('srcRootForCompilationRoot', () => {
      let spy: jest.SpyInstance;
      beforeEach(() => {
        jest.clearAllMocks();
        spy = jest.spyOn(ts, 'createCompilerHost');
      });

      it('should use srcRootForCompilationRoot when it is defined', async () => {
        testOptions.srcRootForCompilationRoot = 'libs/nodelib/src';

        await packageExecutor(testOptions, context);
        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            rootDir: 'libs/nodelib/src',
          })
        );
      });
      it('should not use srcRootForCompilationRoot when it is not defined', async () => {
        testOptions.srcRootForCompilationRoot = undefined;

        await packageExecutor(testOptions, context);

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            rootDir: 'libs/nodelib',
          })
        );
      });
    });
  });

  describe('building with dependencies', () => {
    beforeEach(() => {
      // fake that dep project has been built
      jest
        .spyOn(projectGraph, 'readCachedProjectGraph')
        .mockImplementation(() => {
          return {
            nodes: {
              nodelib: {
                type: ProjectType.lib,
                name: 'nodelib',
                data: {
                  files: [],
                  root: 'libs/nodelib',
                  targets: { build: { executor: 'any builder' } },
                },
              },
              'nodelib-child': {
                type: ProjectType.lib,
                name: 'nodelib-child',
                data: {
                  files: [],
                  root: 'libs/nodelib-child',
                  prefix: 'proj',
                  targets: {
                    build: {
                      executor: 'any builder',
                      options: {
                        assets: [],
                        main: 'libs/nodelib-child/src/index.ts',
                        outputPath: 'dist/libs/nodelib-child',
                        packageJson: 'libs/nodelib-child/package.json',
                        tsConfig: 'libs/nodelib-child/tsconfig.lib.json',
                      },
                    },
                  },
                },
              },
            },
            dependencies: {
              nodelib: [
                {
                  type: ProjectType.lib,
                  target: 'nodelib-child',
                  source: null,
                },
              ],
              'nodelib-child': [],
            },
          } as ProjectGraph;
        });
      // dist/libs/nodelib-child/package.json
      mocked(fsUtility.directoryExists).mockImplementation((arg: string) => {
        return arg.endsWith('dist/libs/nodelib-child');
      });
    });

    it('should call the tsc compiler with the modified tsconfig.json', async () => {
      const tmpTsConfigPath = join(
        '/root',
        'tmp',
        'libs/nodelib',
        'tsconfig.generated.json'
      );

      const tsConfigSpy = jest.spyOn(tsUtils, 'readTsConfig');

      await packageExecutor(testOptions, context);
      expect(tsConfigSpy).toHaveBeenCalledWith(tmpTsConfigPath);
    });
  });
});
